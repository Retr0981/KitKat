import { describe, it, expect } from 'vitest';
import { runSimulation, rankTools, fillParams, formatForPersona, PERSONAS } from '../src/agent-engine.js';
import type { Json, TestingTool } from '../src/types.js';

const tools: TestingTool[] = [
  {
    name: 'shop.search',
    description: 'Search for products by color and size.',
    inputSchema: {
      type: 'object',
      properties: {
        color: { type: 'string', enum: ['red', 'blue'] },
        size: { type: 'string' },
      },
      required: ['color'],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'shop.addToCart',
    description: 'Add a product to the cart.',
    inputSchema: { type: 'object', properties: { productId: { type: 'string' } }, required: ['productId'] },
  },
];

describe('agent engine', () => {
  it('rankTools favors tools matching the goal keywords', () => {
    const ranked = rankTools(tools, ['red', 'dress'], PERSONAS.shopper);
    expect(ranked[0]?.name).toBe('shop.search');
  });

  it('fillParams pulls enum values and guesses from goal', () => {
    const filled = fillParams(tools[0]!, undefined, {}, 'find a red dress in size m');
    expect(filled.color).toBe('red');
    expect(filled.size).toBe('M');
  });

  it('runSimulation discovers, selects, invokes, and decides', async () => {
    const invocations: string[] = [];
    const result = await runSimulation({
      persona: 'shopper',
      goal: 'find a red dress then add it to cart',
      tools,
      invoke: async (name): Promise<Json> => {
        invocations.push(name);
        if (name === 'shop.search') return { results: [{ id: 'p1', name: 'Red Dress' }] };
        if (name === 'shop.addToCart') return { ok: true };
        return null;
      },
      params: { 'shop.addToCart': { productId: 'p1' } },
    });
    expect(result.steps.some((s) => s.phase === 'discover')).toBe(true);
    expect(result.invoked).toContain('shop.search');
    expect(invocations.length).toBeGreaterThan(0);
    // Outcome is success/partial, never a crash.
    expect(['success', 'partial', 'stuck']).toContain(result.outcome);
  });

  it('formatForPersona emits function-calling JSON for gemini', () => {
    const formatted = formatForPersona(
      'gemini',
      [{ name: 'a', description: 'd', source: 'imperative', registeredAt: 0 }],
    );
    const parsed = JSON.parse(formatted);
    expect(parsed[0].type).toBe('function');
  });
});
