/**
 * MAIN-world content script.
 *
 * Runs in the page's own JS context (world: 'MAIN') so it shares the page's
 * `navigator.modelContext`. Responsibilities:
 *  1. Install the `@kitkat/core` interceptor at document_start (before the page
 *     registers tools) and forward observed events to the ISOLATED relay.
 *  2. Answer invoke / overlay / clear requests relayed from the extension UI.
 *  3. Periodically snapshot the captured tool list so the UI stays in sync even
 *     if individual register events were missed.
 */

import { installInterceptor, scanDeclarative, toDescriptor, type InterceptorHandle } from '@kitkat/core';

// --- 1. Install the interceptor --------------------------------------------
const handle: InterceptorHandle = installInterceptor({
  emit: (event) => {
    // Structured clone across worlds — events are plain JSON.
    window.postMessage({ kind: 'kitkat:event', event }, location.origin);
  },
  // No auto-polyfill on real pages: we observe the native API. The polyfill is
  // reserved for the Sandbox iframe + demos.
  autoPolyfill: false,
});

// Announce readiness; the relay will request a snapshot.
window.postMessage({ kind: 'kitkat:ready' }, location.origin);

/** Publish the current tool list (descriptor-only, IPC-safe) to the relay. */
function publishTools() {
  const tools = [...handle.tools().map((t) => toDescriptorScanned(t)), ...scanDeclarative().map(toDescriptor)];
  // Deduplicate by name (a tool may be both registered imperatively and present
  // as a declarative form on the same page).
  const seen = new Map<string, (typeof tools)[number]>();
  for (const t of tools) seen.set(t.name, t);
  window.postMessage({ kind: 'kitkat:tools', tools: [...seen.values()] }, location.origin);
}

// `toDescriptor` strips execute but only accepts ScannedTool; we coerce here.
function toDescriptorScanned(t: ReturnType<InterceptorHandle['tools']>[number]) {
  const { execute: _e, ...rest } = t;
  void _e;
  return rest;
}

// --- 2. Answer UI requests relayed via window.postMessage -------------------
window.addEventListener('message', async (ev) => {
  if (ev.source !== window) return;
  const d = ev.data;
  if (!d || typeof d?.kind !== 'string') return;

  if (d.kind === 'kitkat:invoke') {
    const { reqId, toolName, input } = d as { reqId: string; toolName: string; input: Record<string, unknown> };
    const tool = handle.tools().find((t) => t.name === toolName);
    try {
      if (!tool?.execute) throw new Error(`Tool "${toolName}" has no executable handler in this context`);
      const output = await tool.execute((input ?? {}) as import('@kitkat/core').JsonObject, {
        requestUserInteraction: async () => true,
      });
      window.postMessage({ kind: 'kitkat:invoke-result', reqId, ok: true, output }, location.origin);
    } catch (err) {
      window.postMessage(
        {
          kind: 'kitkat:invoke-result',
          reqId,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        },
        location.origin,
      );
    }
    return;
  }

  if (d.kind === 'kitkat:overlay') {
    toggleOverlay(d.enabled as boolean);
    return;
  }

  if (d.kind === 'kitkat:clear') {
    document.querySelectorAll('.kitkat-overlay-badge').forEach((el) => el.remove());
    return;
  }
});

// --- 3. Periodic snapshot keeps the UI honest -------------------------------
const snapshot = () => publishTools();
// Snapshot on DOM ready + on navigation settle + periodically (cheap).
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', snapshot, { once: true });
} else {
  snapshot();
}
let snapshotTimer: number | undefined;
const scheduleSnapshots = () => {
  window.clearInterval(snapshotTimer);
  snapshotTimer = window.setInterval(snapshot, 1500);
};
scheduleSnapshots();

// --- DOM overlay for declarative tools --------------------------------------
function toggleOverlay(enabled: boolean) {
  document.querySelectorAll('.kitkat-overlay-badge').forEach((el) => el.remove());
  if (!enabled) return;
  for (const form of document.querySelectorAll<HTMLFormElement>('form[toolname]')) {
    const badge = document.createElement('div');
    badge.className = 'kitkat-overlay-badge';
    badge.textContent = `🔧 ${form.getAttribute('toolname')}`;
    Object.assign(badge.style, {
      position: 'absolute',
      top: '-10px',
      right: '-10px',
      background: '#6366f1',
      color: '#fff',
      fontSize: '11px',
      fontFamily: 'monospace',
      padding: '2px 6px',
      borderRadius: '4px',
      zIndex: '2147483647',
      boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
      pointerEvents: 'none',
    } as CSSStyleDeclaration);
    const target = form as HTMLElement;
    const prevPos = getComputedStyle(target).position;
    if (prevPos === 'static') target.style.position = 'relative';
    target.appendChild(badge);
  }
}
