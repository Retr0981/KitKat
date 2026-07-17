/**
 * WebMCP event model — the discriminated union of everything that can happen in
 * a WebMCP-enabled page during a KitKat session. The Debugger renders a
 * timeline of these; the Analytics server ingests them; the Validator produces
 * a summary from them.
 *
 * Events are serializable so they can cross chrome.runtime ports and HTTP.
 */

import type { InvocationResult, JsonObject, ToolDescriptor } from './types.js';

/** Shared fields on every event. */
export interface EventBase {
  /** Monotonic id within a session. */
  id: string;
  /** Discriminator. */
  type: string;
  /** Epoch ms. */
  at: number;
  /** The origin of the page the event occurred on. */
  origin: string;
}

/** A tool became available (registered imperatively or discovered declaratively). */
export interface ToolRegisteredEvent extends EventBase {
  type: 'tool:registered';
  tool: ToolDescriptor;
}

/** A tool was removed. */
export interface ToolUnregisteredEvent extends EventBase {
  type: 'tool:unregistered';
  toolName: string;
}

/** An agent invoked a tool. */
export interface ToolInvokedEvent extends EventBase {
  type: 'tool:invoked';
  toolName: string;
  input: JsonObject;
}

/** A tool execution resolved (success, error, or timeout). */
export interface ToolResultEvent extends EventBase {
  type: 'tool:result';
  result: InvocationResult;
}

/** A tool asked the browser to prompt the user for consent. */
export interface ConsentRequestedEvent extends EventBase {
  type: 'consent:requested';
  toolName: string;
  message: string;
}

/** The user resolved a consent prompt. */
export interface ConsentResolvedEvent extends EventBase {
  type: 'consent:resolved';
  toolName: string;
  granted: boolean;
}

/** A page-level error (handler threw uncaught, polyfill failure, etc.). */
export interface ErrorEvent extends EventBase {
  type: 'error';
  toolName?: string;
  message: string;
  /** Coarse category for analytics bucketing. */
  category: 'schema' | 'permission' | 'timeout' | 'execution' | 'unknown';
}

/** The union of all events. */
export type McpEvent =
  | ToolRegisteredEvent
  | ToolUnregisteredEvent
  | ToolInvokedEvent
  | ToolResultEvent
  | ConsentRequestedEvent
  | ConsentResolvedEvent
  | ErrorEvent;

// ---------------------------------------------------------------------------
// Factory helpers (centralize id + timestamp generation)
// ---------------------------------------------------------------------------

let counter = 0;
const nextId = (): string => `evt_${Date.now().toString(36)}_${(counter++).toString(36)}`;

/**
 * Build an event with id/at filled in. Pass the variant-specific payload plus
 * `type` and `origin`; the helper stamps identity + timestamp. Overloads per
 * event type give exact field inference at every call site.
 *
 * Usage: `makeEvent({ type: 'tool:registered', origin, tool })`.
 */
export function makeEvent(partial: Omit<ToolRegisteredEvent, 'id' | 'at'>): ToolRegisteredEvent;
export function makeEvent(partial: Omit<ToolUnregisteredEvent, 'id' | 'at'>): ToolUnregisteredEvent;
export function makeEvent(partial: Omit<ToolInvokedEvent, 'id' | 'at'>): ToolInvokedEvent;
export function makeEvent(partial: Omit<ToolResultEvent, 'id' | 'at'>): ToolResultEvent;
export function makeEvent(partial: Omit<ConsentRequestedEvent, 'id' | 'at'>): ConsentRequestedEvent;
export function makeEvent(partial: Omit<ConsentResolvedEvent, 'id' | 'at'>): ConsentResolvedEvent;
export function makeEvent(partial: Omit<ErrorEvent, 'id' | 'at'>): ErrorEvent;
export function makeEvent(partial: Omit<McpEvent, 'id' | 'at'>): McpEvent {
  return { id: nextId(), at: Date.now(), ...(partial as object) } as McpEvent;
}

/** Severity used for color-coding in the Debugger timeline + toasts. */
export type Severity = 'success' | 'error' | 'warning' | 'info';

/** Map an event to its display severity (for color-coding). */
export function severityOf(event: McpEvent): Severity {
  switch (event.type) {
    case 'tool:result':
      return event.result.status === 'success' ? 'success' : 'error';
    case 'consent:resolved':
      return event.granted ? 'success' : 'warning';
    case 'consent:requested':
      return 'info';
    case 'tool:registered':
      return 'info';
    case 'tool:unregistered':
      return 'warning';
    case 'tool:invoked':
      return 'info';
    case 'error':
      return 'error';
  }
}
