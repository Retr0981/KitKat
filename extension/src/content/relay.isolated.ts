/**
 * ISOLATED-world content script — the bridge between the page's MAIN world and
 * the extension's service worker.
 *
 *  - Listens for window.postMessage from the MAIN interceptor and forwards
 *    events/tools to the background (tagged with this tab's id).
 *  - Answers background requests to snapshot tools, invoke tools, or toggle the
 *    DOM overlay — anything that needs to run in the page.
 *
 * We cannot directly access `navigator.modelContext` here (isolated world has
 * its own navigator), so tool invocation is delegated back to the MAIN world
 * via a request/response postMessage round-trip.
 */

import type { PageMessage, RelayMessage, UiRequest } from '../messaging/types.js';
import { PAGE_CHANNEL } from '../messaging/types.js';

/** Forward a relay message to the background. */
const toBg = (msg: RelayMessage) => chrome.runtime.sendMessage(msg).catch(() => {});

// Resolve tabId once via a ping the background can answer.
chrome.runtime
  .sendMessage({ kind: 'relay:hello' })
  .then((id: number) => {
    (window as any).__kitkatTabId = id;
  })
  .catch(() => {});

const currentTabId = (): number => (window as any).__kitkatTabId ?? -1;

// --- MAIN → ISOLATED: listen for page events --------------------------------
window.addEventListener('message', async (ev) => {
  if (ev.source !== window) return;
  const data = ev.data as PageMessage;
  if (!data || typeof data.kind !== 'string' || !data.kind.startsWith('kitkat:')) return;

  const tid = currentTabId();
  if (data.kind === 'kitkat:event') {
    await toBg({ kind: 'relay:event', tabId: tid, event: data.event });
  } else if (data.kind === 'kitkat:tools') {
    await toBg({ kind: 'relay:tools', tabId: tid, tools: data.tools });
  } else if (data.kind === 'kitkat:ready') {
    await toBg({ kind: 'relay:request-tools', tabId: tid });
  }
});

// --- BACKGROUND → ISOLATED: handle tab-scoped requests ----------------------
chrome.runtime.onMessage.addListener((msg: UiRequest & { _toMain?: boolean }, _sender, sendResponse) => {
  if (!msg || typeof msg !== 'object' || !('kind' in msg)) return false;

  switch (msg.kind) {
    case 'ui:invoke': {
      // Ask the MAIN world to invoke the tool and reply once.
      const reqId = `invoke_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const onReply = (e: MessageEvent) => {
        const d = e.data;
        if (e.source === window && d?.kind === 'kitkat:invoke-result' && d?.reqId === reqId) {
          window.removeEventListener('message', onReply);
          sendResponse({ ok: d.ok, output: d.output, error: d.error });
        }
      };
      window.addEventListener('message', onReply);
      window.postMessage(
        { kind: 'kitkat:invoke', reqId, toolName: msg.toolName, input: msg.input },
        location.origin,
      );
      return true; // async response
    }
    case 'ui:inject-overlay': {
      // Toggle the DOM overlay (also handled in MAIN world).
      window.postMessage({ kind: 'kitkat:overlay', enabled: msg.enabled }, location.origin);
      sendResponse({ ok: true });
      return false;
    }
    case 'ui:clear': {
      window.postMessage({ kind: 'kitkat:clear' }, location.origin);
      sendResponse({ ok: true });
      return false;
    }
    default:
      return false;
  }
});

// Publish the well-known channel name for the MAIN script (debug aid).
(window as any).__kitkatChannel = PAGE_CHANNEL;
