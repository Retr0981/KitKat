/**
 * In-memory ToolBackend — powers the inline editor surface.
 *
 * Tools are defined right in the web app (name, description, JSON schema, JS
 * handler) and registered into this backend. It runs `@kitkat/core`'s polyfill
 * engine under the hood, so discovery, invocation, validation, and the event
 * stream all work exactly as they would on a real WebMCP page — with zero
 * external dependencies. This is the surface that always works.
 */

import {
  createModelContext,
  getPolyfillInternal,
  makeEvent,
  validateAll,
  type InvocationResult,
  type JsonObject,
  type Json,
  type McpEvent,
  type ModelContextTool,
  type ToolDescriptor,
  type ToolReport,
} from '@kitkat/core';
import type { StreamSubscription, ToolBackend } from './types.js';

// ToolReport is used in the ToolBackend.validate() return type via validateAll.
export type { ToolReport };

/** A tool definition as authored in the inline editor (handler as source string). */
export interface InlineTool {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  /** JS source for the execute handler. Compiled with `new Function`. */
  handlerSource: string;
  readOnlyHint?: boolean;
}

/** The in-memory backend, extended with inline-editor management methods. */
export interface InMemoryBackend extends ToolBackend {
  /** Replace the whole tool set. */
  setTools: (tools: InlineTool[]) => void;
  /** Add or update a single tool. */
  upsertTool: (tool: InlineTool) => void;
  /** Remove a tool by name. */
  removeTool: (name: string) => void;
}

/** A sensible starter tool so the editor isn't empty on first load. */
export const STARTER_TOOL: InlineTool = {
  name: 'demo.search',
  description: 'Search the catalog by free-text query.',
  inputSchema: {
    type: 'object',
    properties: { query: { type: 'string', description: 'search text' } },
    required: ['query'],
  },
  handlerSource: [
    '// Async execute handler. `input` is validated against your schema.',
    '// `client.requestUserInteraction(msg)` prompts the user — call it before',
    '// side effects on non-readOnly tools.',
    'return {',
    '  results: [',
    "    { id: 'r1', name: 'Result for ' + (input.query ?? ''), price: 42 }",
    '  ],',
    '  count: 1',
    '};',
  ].join('\n'),
  readOnlyHint: true,
};

export interface InMemoryOptions {
  /** Called when the consent prompt fires; resolve true to approve. */
  consent?: (toolName: string, message: string) => Promise<boolean>;
}

/** Build an in-memory backend seeded with the given inline tools. */
export function createInMemoryBackend(initial: InlineTool[] = [], opts: InMemoryOptions = {}): InMemoryBackend {
  const { modelContext, modelContextTesting } = createModelContext({
    consent: opts.consent ?? (async () => true),
  });
  const internal = getPolyfillInternal(modelContext)!;

  // Wire polyfill invocation hooks → event emission.
  internal.emitToolInvoked = (toolName: string, input: JsonObject) =>
    emit(makeEvent({ type: 'tool:invoked', origin, toolName, input }));
  internal.emitToolResult = (result: InvocationResult) =>
    emit(makeEvent({ type: 'tool:result', origin, result }));
  internal.emitConsentRequested = (toolName, message) =>
    emit(makeEvent({ type: 'consent:requested', origin, toolName, message }));
  internal.emitConsentResolved = (toolName, granted) =>
    emit(makeEvent({ type: 'consent:resolved', origin, toolName, granted }));

  const subscribers = new Set<StreamSubscription>();
  let events: McpEvent[] = [];
  const MAX = 5000;
  const origin = typeof location !== 'undefined' ? location.origin : 'https://kitkat.local';

  /** Stamp + store + fan out an event. */
  function emit(event: McpEvent) {
    events = [...events, event];
    if (events.length > MAX) events.splice(0, events.length - MAX);
    for (const s of subscribers) s.onEvent(event);
  }

  // Seed tools.
  for (const t of initial) registerInlineTool(t);

  /** Compile + register an inline tool into the polyfill. */
  function registerInlineTool(t: InlineTool) {
    const execute = compileHandler(t.handlerSource);
    const tool: ModelContextTool = {
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      annotations: { readOnlyHint: t.readOnlyHint },
      execute,
    };
    // Remove any existing tool of the same name first (editor updates).
    try {
      modelContext.unregisterTool(t.name);
    } catch {
      /* not registered */
    }
    modelContext.registerTool(tool);
    const descriptor: ToolDescriptor = {
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      annotations: { readOnlyHint: t.readOnlyHint },
      source: 'imperative',
      registeredAt: Date.now(),
    };
    emit(makeEvent({ type: 'tool:registered', origin, tool: descriptor }));
    notifyTools();
  }

  function unregisterInlineTool(name: string) {
    modelContext.unregisterTool(name);
    emit(makeEvent({ type: 'tool:unregistered', origin, toolName: name }));
    notifyTools();
  }

  function notifyTools() {
    const tools = snapshotTools();
    for (const s of subscribers) s.onTools?.(tools);
  }

  // Synchronous descriptor snapshot from the internal registry.
  function snapshotTools(): ToolDescriptor[] {
    return Array.from(internal.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      annotations: t.annotations,
      source: 'imperative' as const,
      registeredAt: t.registeredAt,
    }));
  }

  const backend: InMemoryBackend = {
    source: { kind: 'inline', label: 'Inline tools', canInvoke: true, canOverlay: false },

    getTools: snapshotTools,
    getEvents: () => events,

    subscribe(sub: StreamSubscription) {
      subscribers.add(sub);
      return () => subscribers.delete(sub);
    },

    invoke: async (name, input) => modelContextTesting.executeTool(name, input) as Promise<Json>,

    async validate() {
      const tools = snapshotTools();
      const invoke = backend.invoke;
      return validateAll(tools, {
        invoke,
        consentProbe: async () => ({ requested: false }),
      });
    },

    async setOverlay() {
      /* not available for inline tools */
    },
    async clear() {
      events = [];
      notifyTools();
    },

    setTools(tools: InlineTool[]) {
      internal.tools.clear();
      events = [];
      for (const t of tools) registerInlineTool(t);
    },
    upsertTool: registerInlineTool,
    removeTool: unregisterInlineTool,
  };

  return backend;
}

/** Compile a handler source string into an execute function. */
function compileHandler(source: string): ModelContextTool['execute'] {
  // Handler authors write: async (input, client) => { ... }
  // We wrap in a Function so we don't need eval/eval-with-scope tricks.
  // eslint-disable-next-line no-new-func
  const fn = new Function(
    'input',
    'client',
    `"use strict";\nconst ModelContextClient = client;\n${source}`,
  );
  return (input: JsonObject, client) => fn(input, client) as Json | Promise<Json>;
}
