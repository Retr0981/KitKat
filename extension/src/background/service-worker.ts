/**
 * KitKat service worker (MV3).
 *
 * Responsibilities:
 *  - Route messages: relay (content) ↔ UI (popup/panel). Keeps a per-tab ring
 *    buffer of recent events so a freshly-opened panel sees history.
 *  - Fan streaming events out to any connected UI port for that tab.
 *  - Batch analytics events to the local server (offline queue + retry).
 *  - Open the DevTools panel / side panel on keyboard shortcuts.
 */

import type { McpEvent, ToolDescriptor } from '@kitkat/core';
import type { RelayMessage, StreamMessage, UiRequest } from '../messaging/types.js';
import { STREAM_PORT } from '../messaging/types.js';

// --- Per-tab state ----------------------------------------------------------
interface TabState {
  events: McpEvent[]; // ring buffer (last N)
  tools: ToolDescriptor[];
  ports: Set<chrome.runtime.Port>;
}
const TABS = new Map<number, TabState>();
const MAX_EVENTS = 2000;

function tabState(tabId: number): TabState {
  let s = TABS.get(tabId);
  if (!s) {
    s = { events: [], tools: [], ports: new Set() };
    TABS.set(tabId, s);
  }
  return s;
}

function pushEvent(tabId: number, event: McpEvent) {
  const s = tabState(tabId);
  s.events.push(event);
  if (s.events.length > MAX_EVENTS) s.events.splice(0, s.events.length - MAX_EVENTS);
  for (const port of s.ports) {
    try {
      port.postMessage({ kind: 'stream:event', event } satisfies StreamMessage);
    } catch {
      s.ports.delete(port);
    }
  }
  // Fire-and-forget analytics ingest.
  void analyticsQueue.push(event, tabId);
}

function setTools(tabId: number, tools: ToolDescriptor[]) {
  const s = tabState(tabId);
  s.tools = tools;
  for (const port of s.ports) {
    try {
      port.postMessage({ kind: 'stream:tools', tools } satisfies StreamMessage);
    } catch {
      s.ports.delete(port);
    }
  }
}

// --- Relay → background ------------------------------------------------------
chrome.runtime.onMessage.addListener((msg: RelayMessage | { kind: 'relay:hello' }, sender, sendResponse) => {
  if (!msg || typeof msg !== 'object' || !('kind' in msg)) return false;
  const tabId = sender.tab?.id ?? -1;

  switch (msg.kind) {
    case 'relay:hello':
      sendResponse(tabId);
      return false;
    case 'relay:event':
      pushEvent(msg.tabId >= 0 ? msg.tabId : tabId, msg.event);
      return false;
    case 'relay:tools':
      setTools(msg.tabId >= 0 ? msg.tabId : tabId, msg.tools);
      return false;
    case 'relay:request-tools':
      // Relay wants the page's current tools; we don't store them yet, so a
      // snapshot will arrive via the next relay:tools message.
      return false;
    default:
      return false;
  }
});

// --- UI port connections (streaming) ----------------------------------------
chrome.runtime.onConnect.addListener((port) => {
  if (!port.name.startsWith(STREAM_PORT)) return;
  const tabId = Number(port.name.split(':')[1]);
  if (!Number.isFinite(tabId)) return;
  const s = tabState(tabId);
  s.ports.add(port);
  // Send current snapshot immediately so the UI isn't blank on open.
  try {
    if (s.tools.length) port.postMessage({ kind: 'stream:tools', tools: s.tools } satisfies StreamMessage);
    for (const event of s.events.slice(-200)) {
      port.postMessage({ kind: 'stream:event', event } satisfies StreamMessage);
    }
  } catch {
    /* noop */
  }
  port.onDisconnect.addListener(() => s.ports.delete(port));
});

// --- UI one-shot requests ---------------------------------------------------
chrome.runtime.onMessage.addListener(async (msg: UiRequest, _sender, sendResponse) => {
  if (!msg || typeof msg !== 'object' || !('kind' in msg) || !String(msg.kind).startsWith('ui:')) return false;
  const tabId = msg.tabId;
  try {
    switch (msg.kind) {
      case 'ui:get-tools': {
        const s = TABS.get(tabId);
        sendResponse({ tools: s?.tools ?? [] });
        return false;
      }
      case 'ui:get-events': {
        const s = TABS.get(tabId);
        sendResponse({ events: s?.events ?? [] });
        return false;
      }
      case 'ui:invoke':
      case 'ui:inject-overlay':
      case 'ui:clear': {
        // Forward to the tab's content script (the relay answers).
        const res = await chrome.tabs.sendMessage(tabId, msg).catch((e) => ({
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        }));
        sendResponse(res);
        return false;
      }
      case 'ui:validate': {
        // The Validator runs in the UI; background just returns current tools.
        const s = TABS.get(tabId);
        sendResponse({ reports: [], tools: s?.tools ?? [] } as any);
        return false;
      }
      default:
        return false;
    }
  } catch (err) {
    sendResponse({ error: err instanceof Error ? err.message : String(err) } as any);
    return false;
  }
});

// --- Commands: open panels on keyboard shortcuts ----------------------------
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'open-debugger') {
    await chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      const id = tabs[0]?.id;
      if (id) chrome.sidePanel.open({ tabId: id }).catch(() => {});
    });
  }
  // Validator opens via popup or DevTools; command merely focuses the action.
  if (command === 'open-validator') {
    await chrome.action.openPopup?.().catch(() => {});
  }
});

// Enable the side panel to be opened from the toolbar action's context.
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
});

// Clean up state when a tab closes.
chrome.tabs.onRemoved.addListener((tabId) => {
  TABS.delete(tabId);
});

// --- Analytics batching (offline queue → local server) ----------------------
const SERVER_URL = 'http://localhost:7421';

const analyticsQueue = {
  pending: [] as { event: McpEvent; tabId: number; at: number }[],
  flushing: false,
  push(event: McpEvent, tabId: number) {
    this.pending.push({ event, tabId, at: Date.now() });
    if (this.pending.length >= 25) void this.flush();
    else this.schedule();
  },
  timer: undefined as ReturnType<typeof setTimeout> | undefined,
  schedule() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.flush();
    }, 3000);
  },
  async flush() {
    if (this.flushing || this.pending.length === 0) return;
    this.flushing = true;
    const batch = this.pending.splice(0, 200);
    try {
      await fetch(`${SERVER_URL}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: batch.map((b) => toIngest(b)) }),
      });
    } catch {
      // Server down / not started — re-queue for later (offline-first).
      this.pending.unshift(...batch);
      this.schedule();
    } finally {
      this.flushing = false;
    }
  },
};

/** Shape an event for the analytics server's ingest schema. */
function toIngest(b: { event: McpEvent; tabId: number; at: number }) {
  const e = b.event;
  const toolName =
    e.type === 'tool:registered'
      ? e.tool.name
      : e.type === 'tool:unregistered'
        ? e.toolName
        : 'toolName' in e
          ? e.toolName
          : undefined;
  const status = e.type === 'tool:result' ? e.result.status : undefined;
  return {
    type: e.type,
    origin: e.origin,
    toolName,
    status,
    durationMs: e.type === 'tool:result' ? e.result.durationMs : undefined,
    at: e.at,
    tabId: b.tabId,
  };
}
