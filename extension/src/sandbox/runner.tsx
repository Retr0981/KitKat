/**
 * Sandbox runner — lives inside the sandboxed iframe. Installs the WebMCP
 * polyfill, registers the scenario's tools (sent by the parent via postMessage),
 * and exposes them through `navigator.modelContextTesting` so the agent engine
 * can discover + invoke them in a controlled, side-effect-free environment.
 */

import { installPolyfill } from '@kitkat/core';
import type { TestingTool } from '@kitkat/core';

const { modelContextTesting } = installPolyfill(self as any, { safeMode: true });

// Acknowledge readiness.
self.postMessage({ kind: 'sandbox:ready' }, '*');

self.addEventListener('message', async (ev) => {
  const d = ev.data;
  if (d?.kind === 'sandbox:load') {
    await modelContextTesting.provideContext({ tools: d.tools as TestingTool[] });
    self.postMessage({ kind: 'sandbox:loaded', tools: await modelContextTesting.getTools() }, '*');
  }
  if (d?.kind === 'sandbox:invoke') {
    try {
      const output = await modelContextTesting.executeTool(d.toolName, d.input);
      self.postMessage({ kind: 'sandbox:invoke-result', reqId: d.reqId, ok: true, output }, '*');
    } catch (err) {
      self.postMessage(
        { kind: 'sandbox:invoke-result', reqId: d.reqId, ok: false, error: err instanceof Error ? err.message : String(err) },
        '*',
      );
    }
  }
});

export {};
