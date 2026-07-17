/**
 * Typed message protocol between KitKat surfaces.
 *
 * Two channels:
 *  - **MAIN → ISOLATED**: the MAIN-world interceptor posts events to the page's
 *    window; the ISOLATED relay listens and forwards over chrome.runtime.
 *  - **ISOLATED ↔ BACKGROUND ↔ UI**: chrome.runtime messages/ports. UI surfaces
 *    (popup, devtools panel) subscribe to a long-lived port for streaming.
 *
 * Every message is a discriminated union so handlers can be exhaustively typed.
 */

import type { McpEvent, ToolDescriptor, ToolReport } from '@kitkat/core';

/** Messages from the page (MAIN) to the relay (ISOLATED) via window.postMessage. */
export type PageMessage =
  | { kind: 'kitkat:event'; event: McpEvent }
  | { kind: 'kitkat:tools'; tools: ToolDescriptor[] }
  | { kind: 'kitkat:ready' };

/** Messages from the relay to the background over chrome.runtime. */
export type RelayMessage =
  | { kind: 'relay:event'; tabId: number; event: McpEvent }
  | { kind: 'relay:tools'; tabId: number; tools: ToolDescriptor[] }
  | { kind: 'relay:request-tools'; tabId: number };

/** Requests the UI sends to the background (single round-trip). */
export type UiRequest =
  | { kind: 'ui:get-tools'; tabId: number }
  | { kind: 'ui:get-events'; tabId: number }
  | { kind: 'ui:invoke'; tabId: number; toolName: string; input: Record<string, unknown> }
  | { kind: 'ui:validate'; tabId: number }
  | { kind: 'ui:inject-overlay'; tabId: number; enabled: boolean }
  | { kind: 'ui:clear'; tabId: number };

/** Responses to UI requests. */
export type UiResponse<T extends UiRequest['kind'] = UiRequest['kind']> =
  T extends 'ui:get-tools' ? { tools: ToolDescriptor[] }
  : T extends 'ui:get-events' ? { events: McpEvent[] }
  : T extends 'ui:invoke' ? { ok: boolean; output?: unknown; error?: string }
  : T extends 'ui:validate' ? { reports: ToolReport[] }
  : T extends 'ui:inject-overlay' ? { ok: boolean }
  : T extends 'ui:clear' ? { ok: boolean }
  : never;

/** Long-lived port messages (streaming from background to UI). */
export type StreamMessage =
  | { kind: 'stream:event'; event: McpEvent }
  | { kind: 'stream:tools'; tools: ToolDescriptor[] };

/** The well-known window-event name for MAIN↔ISOLATED comms. */
export const PAGE_CHANNEL = 'kitkat-page-channel';

/** The well-known chrome.runtime port name for streaming. */
export const STREAM_PORT = 'kitkat-stream';
