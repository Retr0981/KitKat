/**
 * WebMCP polyfill — a spec-accurate in-page implementation of
 * `navigator.modelContext` and `navigator.modelContextTesting`.
 *
 * Why this exists:
 *  - Chrome ships WebMCP behind `#enable-webmcp-testing` (146+); most users and
 *    all test runners don't have it. The polyfill lets demos, the Sandbox, and
 *    pre-149 fallback work identically.
 *  - The Sandbox loads scenarios in a sandboxed iframe with this injected so
 *    handlers run in a controlled environment with **safe mode** (mock returns,
 *    no real side effects).
 *
 * Spec fidelity:
 *  - `registerTool` throws `InvalidStateError` on duplicate/empty/invalid name
 *    (per W3C IDL).
 *  - `getTools()` returns tools without `execute`; `executeTool()` runs it with a
 *    real {@link ModelContextClient} whose `requestUserInteraction` resolves via
 *    an injectable consent callback (the Sandbox wires this to its UI).
 *  - `SecureContext` + same-origin semantics are enforced by the host, not here.
 */

import type {
  InvocationResult,
  JsonObject,
  Json,
  ModelContext,
  ModelContextClient,
  ModelContextTesting,
  ModelContextTool,
  RegisteredTool,
  TestingTool,
} from './types.js';

/**
 * Callback the polyfill calls whenever a tool asks for user consent. Should
 * resolve true if the user approves. Default auto-approves (test mode).
 */
export type ConsentHandler = (toolName: string, message: string) => Promise<boolean>;

/** Callback fired whenever a tool is registered/unregistered (for interceptor). */
export type RegistryListener = (tools: RegisteredTool[]) => void;

/**
 * Options for {@link installPolyfill}.
 */
export interface PolyfillOptions {
  /** Force install even if a native modelContext is present. Default false. */
  force?: boolean;
  /** Override the consent prompt behavior. Default auto-approves. */
  consent?: ConsentHandler;
  /** Safe mode: handlers are never run; a canned mock is returned instead. */
  safeMode?: boolean;
  /** Notify on every registry mutation (used by the interceptor). */
  onRegistryChange?: RegistryListener;
}

/** Symbols stored on the polyfill instance to keep state private from the page. */
const INTERNAL = Symbol('kitkat.polyfill.internal');

interface PolyfillInternal {
  tools: Map<string, RegisteredTool>;
  consent: ConsentHandler;
  safeMode: boolean;
  listeners: Set<RegistryListener>;
  /** Hook for emitting events back to the interceptor (set when bridged). */
  emitToolInvoked?: (name: string, input: JsonObject) => void;
  emitToolResult?: (result: InvocationResult) => void;
  emitConsentRequested?: (toolName: string, message: string) => void;
  emitConsentResolved?: (toolName: string, granted: boolean) => void;
}

/** Default consent handler — auto-approves (useful for tests / safe mode). */
const autoApprove: ConsentHandler = async () => true;

/** Validate a tool name per spec (non-empty dotted identifier). */
function assertValidName(name: unknown): asserts name is string {
  if (typeof name !== 'string' || name.length === 0) {
    throw new DOMException('Tool name must be a non-empty string', 'InvalidStateError');
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/.test(name)) {
    throw new DOMException(
      `Invalid tool name "${name}" — must be a dotted identifier`,
      'InvalidStateError',
    );
  }
}

/** Strip a registered tool to the testing-API shape (no execute). */
function toTestingTool(tool: RegisteredTool): TestingTool {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: tool.annotations,
  };
}

/**
 * Build the modelContext + modelContextTesting pair backed by shared state.
 * Exported so the Sandbox and the interceptor can reuse the same engine.
 */
export function createModelContext(opts: PolyfillOptions = {}): {
  modelContext: ModelContext & { [INTERNAL]: PolyfillInternal };
  modelContextTesting: ModelContextTesting;
} {
  const internal: PolyfillInternal = {
    tools: new Map(),
    consent: opts.consent ?? autoApprove,
    safeMode: opts.safeMode ?? false,
    listeners: new Set(opts.onRegistryChange ? [opts.onRegistryChange] : []),
  };

  const notify = () => {
    const snapshot = Array.from(internal.tools.values());
    for (const l of internal.listeners) l(snapshot);
  };

  const makeClient = (toolName: string): ModelContextClient => ({
    requestUserInteraction: async (message: string) => {
      internal.emitConsentRequested?.(toolName, message);
      const granted = await internal.consent(toolName, message);
      internal.emitConsentResolved?.(toolName, granted);
      return granted;
    },
  });

  const modelContext: ModelContext & { [INTERNAL]: PolyfillInternal } = {
    [INTERNAL]: internal,
    registerTool(tool: ModelContextTool) {
      assertValidName(tool.name);
      if (internal.tools.has(tool.name)) {
        throw new DOMException(`Tool "${tool.name}" is already registered`, 'InvalidStateError');
      }
      internal.tools.set(tool.name, {
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
        source: 'imperative',
        execute: tool.execute,
        registeredAt: Date.now(),
      });
      notify();
    },
    unregisterTool(name: string) {
      if (internal.tools.delete(name)) notify();
    },
  };

  const executeTool = async (name: string, input: JsonObject): Promise<Json> => {
    const tool = internal.tools.get(name);
    if (!tool) {
      throw new DOMException(`Unknown tool "${name}"`, 'NotFoundError');
    }
    internal.emitToolInvoked?.(name, input);
    const startedAt = Date.now();
    const start = performance.now();
    try {
      let output: Json;
      if (internal.safeMode) {
        // Safe mode: return a deterministic mock based on schema, never run handler.
        output = mockOutput(tool.inputSchema);
      } else if (!tool.execute) {
        // Declarative tool registered without a JS handler — synthesize from form.
        output = { ok: true, declared: true, echo: input };
      } else {
        output = await tool.execute(input ?? {}, makeClient(name));
      }
      const durationMs = Math.round(performance.now() - start);
      internal.emitToolResult?.({
        toolName: name,
        input,
        status: 'success',
        output,
        durationMs,
        startedAt,
      });
      return output;
    } catch (err) {
      const durationMs = Math.round(performance.now() - start);
      const errorMessage = err instanceof Error ? err.message : String(err);
      internal.emitToolResult?.({
        toolName: name,
        input,
        status: 'error',
        errorMessage,
        durationMs,
        startedAt,
      });
      throw err;
    }
  };

  const modelContextTesting: ModelContextTesting = {
    getTools: async () => Array.from(internal.tools.values()).map(toTestingTool),
    executeTool,
    provideContext: async ({ tools }: { tools: TestingTool[] }) => {
      internal.tools.clear();
      for (const t of tools) {
        internal.tools.set(t.name, { ...t, source: 'imperative', registeredAt: Date.now() });
      }
      notify();
    },
    clearContext: async () => {
      internal.tools.clear();
      notify();
    },
  };

  return { modelContext, modelContextTesting };
}

/** Access the internal state of a polyfill-installed modelContext (internal API). */
export function getPolyfillInternal(mc: ModelContext): PolyfillInternal | undefined {
  const withSymbol = mc as ModelContext & { [INTERNAL]?: PolyfillInternal };
  return withSymbol[INTERNAL];
}

/**
 * Install the polyfill on a target global (defaults to the current `globalThis`).
 * No-ops if a native modelContext already exists and `force` is false.
 *
 * Returns the installed instances and an `uninstall` for tests.
 */
export function installPolyfill(
  target: any = globalThis,
  opts: PolyfillOptions = {},
): { installed: boolean; modelContext: ModelContext; modelContextTesting: ModelContextTesting; uninstall: () => void } {
  const hasNative = typeof target.navigator?.modelContext === 'object';
  const shouldInstall = opts.force || !hasNative;

  if (!shouldInstall) {
    // Native present and not forced — return the native surface as-is.
    return {
      installed: false,
      modelContext: target.navigator.modelContext,
      modelContextTesting: target.navigator.modelContextTesting,
      uninstall: () => {},
    };
  }

  const { modelContext, modelContextTesting } = createModelContext(opts);

  // Define on navigator in a non-writable way to mimic native.
  try {
    Object.defineProperty(target.navigator, 'modelContext', {
      value: modelContext,
      configurable: true,
    });
    Object.defineProperty(target.navigator, 'modelContextTesting', {
      value: modelContextTesting,
      configurable: true,
    });
  } catch {
    // navigator may be read-only in some contexts; fall back to global.
    target.navigator = new Proxy(target.navigator || {}, {
      get(t, p) {
        if (p === 'modelContext') return modelContext;
        if (p === 'modelContextTesting') return modelContextTesting;
        return Reflect.get(t, p);
      },
    });
  }

  return {
    installed: true,
    modelContext,
    modelContextTesting,
    uninstall: () => {
      try {
        delete target.navigator.modelContext;
        delete target.navigator.modelContextTesting;
      } catch {
        /* noop */
      }
    },
  };
}

/** Produce a deterministic mock output for safe-mode sandbox execution. */
function mockOutput(schema: unknown): Json {
  const s = schema as { type?: string; properties?: Record<string, unknown> } | undefined;
  if (!s || typeof s !== 'object') return { ok: true, mock: true };
  if (s.type === 'object' && s.properties) {
    const out: JsonObject = {};
    for (const [key, val] of Object.entries(s.properties)) {
      out[key] = mockOutput(val);
    }
    return out;
  }
  switch (s.type) {
    case 'string':
      return 'mock';
    case 'number':
    case 'integer':
      return 0;
    case 'boolean':
      return false;
    case 'array':
      return [];
    default:
      return null;
  }
}
