/**
 * ToolBackend — the single abstraction every UI module talks to.
 *
 * Both the web app and the Chrome extension implement this interface. Modules
 * never call `chrome.*` or `fetch()` directly; they call `useBackend()`. This
 * is what lets the redesigned Validator/Debugger/Sandbox/Analytics run
 * identically in a hosted web page and inside an extension DevTools panel.
 *
 * The shape mirrors `@kitkat/core`'s callback-based APIs (InvokeFn etc.) plus
 * the streaming contract from the extension's messaging layer, unified.
 */

import type { InvokeFn } from '@kitkat/core';
import type { McpEvent, ToolDescriptor, ToolReport } from '@kitkat/core';

/** What kind of source is backing the current session. */
export type BackendSourceKind = 'inline' | 'demo' | 'url' | 'extension';

export interface BackendSource {
  kind: BackendSourceKind;
  /** Human label, e.g. "Inline tools", "demo: ecommerce", the URL. */
  label: string;
  /** Whether tools can be invoked (some sources are read-only). */
  canInvoke: boolean;
  /** Whether the DOM overlay feature is available (only real pages). */
  canOverlay: boolean;
}

/** Subscription to the live event stream. Returns an unsubscribe fn. */
export type StreamSubscription = {
  onEvent: (event: McpEvent) => void;
  onTools?: (tools: ToolDescriptor[]) => void;
};

export interface ToolBackend {
  /** Human description of the current source. */
  source: BackendSource;

  /** Current snapshot of tools (synchronous). */
  getTools(): ToolDescriptor[];

  /** Current snapshot of recent events (synchronous). */
  getEvents(): McpEvent[];

  /** Subscribe to live tool + event changes. Returns unsubscribe. */
  subscribe(sub: StreamSubscription): () => void;

  /** Invoke a tool by name. Rejects if the backend can't execute. */
  invoke: InvokeFn;

  /** Run the full validation suite for the current tools. Resolves reports. */
  validate(): Promise<ToolReport[]>;

  /** Toggle DOM overlay highlighting (no-op on backends without a real page). */
  setOverlay(enabled: boolean): Promise<void>;

  /** Clear the timeline / tool registry (when supported). */
  clear(): Promise<void>;
}
