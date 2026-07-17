import { describe, it, expect } from 'vitest';
import {
  validateTool,
  generateInputs,
  minimalValidInput,
  reportToMarkdown,
  type InvokeFn,
} from '../src/validation.js';
import type { ToolDescriptor } from '../src/types.js';

const makeTool = (over: Partial<ToolDescriptor> = {}): ToolDescriptor => ({
  name: 'shop.search',
  description: 'Search products by query and color.',
  source: 'imperative',
  registeredAt: Date.now(),
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'search text', minLength: 1 },
      color: { type: 'string', description: 'filter by color', enum: ['red', 'blue', 'green'] },
    },
    required: ['query'],
  },
  ...over,
});

describe('validation engine', () => {
  it('minimalValidInput fills required fields with schema defaults', () => {
    const input = minimalValidInput(makeTool().inputSchema);
    expect(input).toEqual({ query: 'test' });
  });

  it('generateInputs produces valid + invalid cases', () => {
    const inputs = generateInputs(makeTool().inputSchema);
    const labels = inputs.map((i) => i.label);
    expect(labels).toContain('valid');
    expect(labels).toContain('unicode-in-strings');
    expect(inputs.find((i) => i.label === 'empty-object')?.expectOk).toBe(false);
  });

  it('reports pass for a well-behaved tool', async () => {
    const tool = makeTool();
    const invoke: InvokeFn = async (name, input) => {
      if (name !== tool.name) throw new Error('unknown');
      if (typeof (input as any).query !== 'string') throw new Error('query must be string');
      return { results: [], echo: input };
    };
    const report = await validateTool(tool, { invoke });
    expect(report.status).not.toBe('fail');
    const schema = report.categories.find((c) => c.id === 'schema')!;
    expect(schema.status).toBe('pass');
  });

  it('fails schema category when inputSchema is missing', async () => {
    const tool = makeTool({ inputSchema: undefined });
    const report = await validateTool(tool, { invoke: async () => ({}) });
    const schema = report.categories.find((c) => c.id === 'schema')!;
    const declared = schema.checks.find((c) => c.id === 'schema.declared')!;
    expect(declared.status).toBe('fail');
    expect(declared.fix).toBeTruthy();
  });

  it('fails execution when output is not JSON-serializable', async () => {
    const tool = makeTool();
    const invoke: InvokeFn = async () => {
      const bad: any = {};
      bad.self = bad; // circular
      return bad;
    };
    const report = await validateTool(tool, { invoke });
    const exec = report.categories.find((c) => c.id === 'execution')!;
    const ser = exec.checks.find((c) => c.id === 'execution.serializable')!;
    expect(ser.status).toBe('fail');
  });

  it('fails security when a mutating tool never requests consent', async () => {
    const tool = makeTool({
      name: 'shop.purchase',
      description: 'purchase the product',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    });
    const invoke: InvokeFn = async () => ({ ok: true });
    const report = await validateTool(tool, {
      invoke,
      consentProbe: async () => ({ requested: false }),
    });
    const sec = report.categories.find((c) => c.id === 'security')!;
    const consent = sec.checks.find((c) => c.id === 'security.consent')!;
    expect(consent.status).toBe('fail');
  });

  it('reportToMarkdown renders headings + badges', async () => {
    const tool = makeTool();
    const report = await validateTool(tool, { invoke: async () => ({ ok: true }) });
    const md = reportToMarkdown([report]);
    expect(md).toContain('# WebMCP Validation Report');
    expect(md).toContain(tool.name);
  });
});
