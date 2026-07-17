import { describe, it, expect, beforeEach } from 'vitest';
import { installPolyfill, createModelContext, getPolyfillInternal } from '../src/polyfill.js';
import type { ModelContextTool } from '../src/types.js';

describe('polyfill', () => {
  beforeEach(() => {
    // Clean any polyfill-installed globals between tests.
    try {
      delete (globalThis.navigator as any).modelContext;
      delete (globalThis.navigator as any).modelContextTesting;
    } catch {
      /* noop */
    }
  });

  it('installs navigator.modelContext + modelContextTesting when none exists', () => {
    const { installed } = installPolyfill();
    expect(installed).toBe(true);
    expect(typeof globalThis.navigator.modelContext).toBe('object');
    expect(typeof globalThis.navigator.modelContextTesting).toBe('object');
  });

  it('does not overwrite a native surface unless forced', () => {
    const fakeNative = { registerTool: () => {}, unregisterTool: () => {} };
    Object.defineProperty(globalThis.navigator, 'modelContext', { value: fakeNative, configurable: true });
    const { installed, modelContext } = installPolyfill();
    expect(installed).toBe(false);
    expect(modelContext).toBe(fakeNative);
  });

  it('throws InvalidStateError on duplicate tool name', () => {
    const { modelContext } = installPolyfill();
    const tool: ModelContextTool = {
      name: 'shop.search',
      description: 'search products',
      execute: async () => ({ ok: true }),
    };
    modelContext.registerTool(tool);
    expect(() => modelContext.registerTool(tool)).toThrow(DOMException);
    expect(() => modelContext.registerTool(tool)).toThrow(/already registered/);
  });

  it('throws on invalid tool names', () => {
    const { modelContext } = installPolyfill();
    expect(() => modelContext.registerTool({ name: '', description: '', execute: async () => null })).toThrow();
    expect(() =>
      modelContext.registerTool({ name: 'bad name!', description: '', execute: async () => null }),
    ).toThrow();
  });

  it('executeTool runs the handler and returns output', async () => {
    const { modelContext, modelContextTesting } = installPolyfill();
    modelContext.registerTool({
      name: 'echo',
      description: 'echo input',
      inputSchema: { type: 'object', properties: { msg: { type: 'string' } }, required: ['msg'] },
      execute: async (input) => ({ echoed: input.msg ?? '' }),
    });
    const out = await modelContextTesting.executeTool('echo', { msg: 'hi' });
    expect(out).toEqual({ echoed: 'hi' });
  });

  it('safe mode returns mock output without running the handler', async () => {
    // Use createModelContext to avoid navigator-global side effects in jsdom.
    const { modelContext, modelContextTesting } = createModelContext({ safeMode: true });
    let ran = false;
    modelContext.registerTool({
      name: 'danger',
      description: 'should not run',
      inputSchema: { type: 'object', properties: { n: { type: 'number' } } },
      execute: async () => {
        ran = true;
        return { sideEffect: true };
      },
    });
    const out = (await modelContextTesting.executeTool('danger', { n: 5 })) as any;
    expect(ran).toBe(false);
    expect(out.n).toBe(0);
  });

  it('notifies registry listeners on add/remove', () => {
    const seen: string[] = [];
    const { modelContext } = createModelContext({ onRegistryChange: (tools) => seen.push(tools.map((t) => t.name).join(',')) });
    modelContext.registerTool({ name: 'a', description: '', execute: async () => null });
    modelContext.registerTool({ name: 'b', description: '', execute: async () => null });
    modelContext.unregisterTool('a');
    expect(seen).toEqual(['a', 'a,b', 'b']);
  });

  it('requestUserInteraction routes through the consent handler', async () => {
    let consentMsg = '';
    const { modelContext, modelContextTesting } = createModelContext({
      consent: async (_name, message) => {
        consentMsg = message;
        return true;
      },
    });
    modelContext.registerTool({
      name: 'buy',
      description: 'purchase',
      execute: async (_input, client) => {
        const ok = await client.requestUserInteraction('Confirm purchase?');
        return { purchased: ok };
      },
    });
    const out = await modelContextTesting.executeTool('buy', {});
    expect(consentMsg).toBe('Confirm purchase?');
    expect(out).toEqual({ purchased: true });
  });

  it('emits toolInvoked/result hooks on the internal API', async () => {
    const { modelContext, modelContextTesting } = createModelContext();
    const internal = getPolyfillInternal(modelContext)!;
    const invoked: string[] = [];
    const statuses: string[] = [];
    internal.emitToolInvoked = (name) => invoked.push(name);
    internal.emitToolResult = (r) => statuses.push(r.status);
    modelContext.registerTool({ name: 'x', description: '', execute: async () => 42 });
    await modelContextTesting.executeTool('x', {});
    expect(invoked).toEqual(['x']);
    expect(statuses).toEqual(['success']);
  });
});
