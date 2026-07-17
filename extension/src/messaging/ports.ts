/**
 * Typed wrappers around chrome.runtime messaging + ports.
 *
 * These hide the noisy `chrome.runtime` API behind a small, typed surface so
 * UI code reads like ordinary async calls + an event emitter.
 */

import type { McpEvent, ToolDescriptor } from '@kitkat/core';
import type { StreamMessage, UiRequest, UiResponse } from './types.js';
import { STREAM_PORT } from './types.js';

/** Send a one-shot request to the background; resolves with the typed reply. */
export function sendBg<T extends UiRequest>(msg: T): Promise<UiResponse<T['kind']>> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (res) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(res as UiResponse<T['kind']>);
    });
  });
}

/** Listener for one-shot requests in the background. */
export function onBgRequest(handler: (msg: UiRequest, sender: chrome.runtime.MessageSender) => void): void {
  chrome.runtime.onMessage.addListener((msg, sender, _sendResponse) => {
    if (msg && typeof msg === 'object' && 'kind' in msg && String(msg.kind).startsWith('ui:')) {
      handler(msg as UiRequest, sender);
    }
    // We return false (synchronous) — background uses async sendResponse internally
    // via the dedicated response channel. Keep the listener from being treated as async.
    return false;
  });
}

export interface StreamSubscription {
  onEvent: (event: McpEvent) => void;
  onTools?: (tools: ToolDescriptor[]) => void;
}

/**
 * Subscribe to the streaming port for a tab. Returns an unsubscribe function.
 * The connection auto-reconnects if the service worker restarts (MV3 lifecycle).
 */
export function subscribeStream(tabId: number, sub: StreamSubscription): () => void {
  let port: chrome.runtime.Port | null = null;
  let closed = false;

  const connect = () => {
    if (closed) return;
    port = chrome.runtime.connect({ name: `${STREAM_PORT}:${tabId}` });
    port.onMessage.addListener((msg: StreamMessage) => {
      if (msg.kind === 'stream:event') sub.onEvent(msg.event);
      else if (msg.kind === 'stream:tools') sub.onTools?.(msg.tools);
    });
    port.onDisconnect.addListener(() => {
      port = null;
      // MV3 service workers die; reconnect after a beat.
      setTimeout(connect, 300);
    });
  };
  connect();

  return () => {
    closed = true;
    port?.disconnect();
  };
}
