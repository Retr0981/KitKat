/**
 * @kitkat/core — WebMCP type definitions
 *
 * These mirror the W3C WebMCP IDL (draft Community Group Report) and Chrome's
 * shipping surface (Chrome 146+ behind #enable-webmcp-testing). They are the
 * single source of truth for every module: the polyfill implements them, the
 * interceptor observes them, the validator checks them, the debugger renders
 * them, and the sandbox simulates them.
 *
 * Spec ref: https://developer.chrome.com/docs/ai/webmcp
 *           https://github.com/webmachinelearning/webmcp
 *
 * Design note: the production `execute` handler is non-serializable, so internal
 * code uses {@link RegisteredTool} (which keeps a reference to `execute`) while
 * anything crossing an IPC boundary (content script → extension) uses
 * {@link ToolDescriptor} (which drops it).
 */

// ---------------------------------------------------------------------------
// JSON Schema alias (WebMCP input schemas are standard JSON Schema draft-07)
// ---------------------------------------------------------------------------

/**
 * A JSON Schema (draft-07) describing a tool's input. WebMCP input schemas use
 * the same subset as MCP: a top-level object with `type`, `properties`,
 * `required`, etc. We keep this loose to stay forward-compatible with spec
 * evolution.
 */
export type JsonSchema = Record<string, unknown>;

/** A plain JSON-serializable value (what a tool may return or accept). */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** A JSON object — the conventional shape of a tool's `input` argument. */
export type JsonObject = { [key: string]: Json };

// ---------------------------------------------------------------------------
// Production API: navigator.modelContext  (W3C IDL mirror)
// ---------------------------------------------------------------------------

/**
 * Hints an agent uses to decide whether a tool is safe to auto-invoke.
 * Mirrors the MCP `annotations` concept; only `readOnlyHint` is standardized
 * today — the rest are reserved for forward compatibility.
 */
export interface ToolAnnotations {
  /** If true, the tool does not mutate state and may be auto-invoked. */
  readOnlyHint?: boolean;
  /** If true, the tool only emits information (no side effects). Reserved. */
  destructiveHint?: boolean;
  /** If true, the tool is idempotent. Reserved. */
  idempotentHint?: boolean;
  /** If true, the tool interacts with an external entity. Reserved. */
  openWorldHint?: boolean;
  /** Vendor/user extensions. */
  [key: string]: unknown;
}

/**
 * A tool definition as passed to `navigator.modelContext.registerTool()`.
 * The `execute` handler runs in the page's origin and may be async.
 */
export interface ModelContextTool {
  /** Dotted, stable, page-unique tool name (e.g. `shop.searchProducts`). */
  name: string;
  /** Human + agent readable description; tells the model WHEN to call. */
  description: string;
  /** JSON Schema for the tool's input object. Optional but strongly recommended. */
  inputSchema?: JsonSchema;
  /**
   * Optional annotations. Set `readOnlyHint: true` for tools that only read.
   * Sensitive (non-readOnly) tools should call `client.requestUserInteraction()`
   * before performing side effects.
   */
  annotations?: ToolAnnotations;
  /**
   * The handler invoked when an agent calls this tool. Receives the validated
   * input and a {@link ModelContextClient} for consent / context queries.
   * May return a value or throw.
   */
  execute: (input: JsonObject, client: ModelContextClient) => Json | Promise<Json>;
}

/**
 * The runtime object passed into `execute`. The key method is
 * {@link requestUserInteraction}, which triggers the browser's consent prompt —
 * the WebMCP security primitive for non-readOnly tools.
 */
export interface ModelContextClient {
  /**
   * Ask the browser to show the user a confirmation prompt. Resolves true if
   * the user approved. Sensitive tools MUST call this before side effects.
   */
  requestUserInteraction: (message: string) => Promise<boolean>;
}

/**
 * The production WebMCP API surface on `navigator`. Available in secure
 * (HTTPS), top-level browsing contexts when the `tools` Permissions Policy is
 * enabled and (today) a flag is on.
 */
export interface ModelContext {
  /** Register a tool. Throws InvalidStateError on duplicate/empty/invalid name. */
  registerTool: (tool: ModelContextTool) => void;
  /** Remove a previously registered tool by name. No-op if absent. */
  unregisterTool: (name: string) => void;
}

// ---------------------------------------------------------------------------
// Testing API: navigator.modelContextTesting  (Chrome 146+, behind flag)
// ---------------------------------------------------------------------------

/** A tool as seen by an agent via the testing API — `execute` stripped. */
export interface TestingTool {
  name: string;
  description: string;
  inputSchema?: JsonSchema;
  annotations?: ToolAnnotations;
}

/**
 * The testing/agent API. This is what KitKat's Validator and Debugger use to
 * discover and invoke tools. When the native surface is absent (pre-146, or
 * flag off), {@link ./polyfill} provides an equivalent implementation.
 */
export interface ModelContextTesting {
  /** List all currently registered tools (declarative + imperative). */
  getTools: () => Promise<TestingTool[]>;
  /** Invoke a tool by name with the given input object. */
  executeTool: (name: string, input: JsonObject) => Promise<Json>;
  /**
   * Inject tools for testing (used by declarative shim / sandbox). Replaces the
   * tool set for the calling context.
   */
  provideContext: (context: { tools: TestingTool[] }) => Promise<void>;
  /** Remove all tools for the calling context. */
  clearContext: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Internal / IPC-safe representations
// ---------------------------------------------------------------------------

/**
 * Internal record of a registered tool, keeping the live `execute` handler.
 * Lives in the MAIN world (or polyfill) and never crosses IPC.
 */
export interface RegisteredTool {
  name: string;
  description: string;
  inputSchema?: JsonSchema;
  annotations?: ToolAnnotations;
  /** How the tool was registered: imperative JS or declarative HTML attributes. */
  source: 'imperative' | 'declarative';
  /** The live execute handler (NOT serializable — never send over IPC). */
  execute?: ModelContextTool['execute'];
  /** When the tool was registered (epoch ms). */
  registeredAt: number;
}

/**
 * A serializable snapshot of a tool — safe to send from a content script to the
 * extension. Includes state used by the Debugger.
 */
export interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema?: JsonSchema;
  annotations?: ToolAnnotations;
  source: 'imperative' | 'declarative';
  registeredAt: number;
  /** Selector for declarative tools (for DOM overlay highlighting). */
  selector?: string;
}

// ---------------------------------------------------------------------------
// Result of invoking a tool (used by Validator, Debugger, Sandbox)
// ---------------------------------------------------------------------------

/** Outcome categories for analytics + categorization. */
export type ResultStatus = 'success' | 'error' | 'timeout';

/**
 * Captured result of a single tool invocation. Produced by the test harness,
 * interceptor, and agent engine alike.
 */
export interface InvocationResult {
  toolName: string;
  input: JsonObject;
  /** 'ok' for a returned value, 'error' if execute threw, 'timeout' if it exceeded the limit. */
  status: ResultStatus;
  /** The returned value (on success) — JSON-serializable. */
  output?: Json;
  /** Error message (on error/timeout). */
  errorMessage?: string;
  /** Wall-clock execution duration in milliseconds. */
  durationMs: number;
  /** Whether the user-consent flow was invoked during execution. */
  consentRequested?: boolean;
  /** Whether consent was granted (when requested). */
  consentGranted?: boolean;
  /** Epoch ms when the invocation started. */
  startedAt: number;
}
