/**
 * Validation engine — KitKat's Validator brain.
 *
 * For each tool we run five categories (per spec) and produce a structured
 * report with pass/fail/warn + fix suggestions. The engine is pure: it takes a
 * tool descriptor + an invoker and returns results, so it runs identically in
 * the extension, tests, and CLI.
 *
 * Categories:
 *   1. schema     — valid, complete, compilable JSON Schema
 *   2. parameter  — generated valid/edge/invalid inputs behave correctly
 *   3. execution  — the returned value is JSON-serializable + matches shape
 *   4. error      — bad input throws a descriptive error (no crash)
 *   5. security   — non-readOnly tools trigger a consent prompt; sensitive keys
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type {
  InvocationResult,
  JsonObject,
  Json,
  JsonSchema,
  ToolDescriptor,
} from './types.js';

/** How a single check within a category turned out. */
export type CheckStatus = 'pass' | 'fail' | 'warn';

/** One check inside a category. */
export interface Check {
  /** Stable machine id, e.g. `schema.required-declared`. */
  id: string;
  label: string;
  status: CheckStatus;
  message?: string;
  /** Concrete fix suggestion (markdown). */
  fix?: string;
}

/** A category groups related checks. */
export interface CategoryResult {
  id: 'schema' | 'parameter' | 'execution' | 'error' | 'security';
  label: string;
  status: CheckStatus;
  checks: Check[];
  /** Wall-clock duration of this category in ms. */
  durationMs: number;
}

/** The full report for one tool. */
export interface ToolReport {
  tool: ToolDescriptor;
  status: CheckStatus;
  categories: CategoryResult[];
  durationMs: number;
  /** Epoch ms. */
  generatedAt: number;
}

/** How the engine invokes a tool for execution/error/security checks. */
export type InvokeFn = (
  name: string,
  input: JsonObject,
) => Promise<Json>;

/** Hook the security check uses to learn whether consent was requested. */
export type ConsentProbe = (name: string, input: JsonObject) => Promise<{
  requested: boolean;
  granted?: boolean;
}>;

export interface ValidationOptions {
  /** Per-tool invocation timeout (ms). Default 2000. */
  timeoutMs?: number;
  /** Custom invoker (defaults to throwing — callers must supply one). */
  invoke?: InvokeFn;
  /** Consent probe for the security category. */
  consentProbe?: ConsentProbe;
  /** Sensitive keywords that should warn if in name/description. */
  sensitiveKeywords?: string[];
}

const DEFAULT_SENSITIVE = [
  'delete', 'remove', 'drop', 'purchase', 'buy', 'pay', 'charge', 'transfer',
  'send', 'submit', 'order', 'refund', 'withdraw', 'update', 'set', 'create',
];

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Validate a single tool end-to-end. Returns a structured report.
 * Throws if `invoke` is missing and the tool isn't readOnly (execution needs it).
 */
export async function validateTool(
  tool: ToolDescriptor,
  opts: ValidationOptions = {},
): Promise<ToolReport> {
  const startedAt = Date.now();
  const start = performance.now();
  const invoke = opts.invoke ?? (async () => { throw new Error('no invoke provided'); });
  const sensitive = opts.sensitiveKeywords ?? DEFAULT_SENSITIVE;

  const categories: CategoryResult[] = [];

  const schemaCat = runSchemaCategory(tool);
  categories.push(schemaCat);

  const paramInputs = generateInputs(tool.inputSchema);
  const paramCat = await runParameterCategory(tool, paramInputs, invoke, opts.timeoutMs ?? 2000);
  categories.push(paramCat);

  const execCat = await runExecutionCategory(tool, invoke, opts.timeoutMs ?? 2000);
  categories.push(execCat);

  const errorCat = await runErrorCategory(tool, invoke, opts.timeoutMs ?? 2000);
  categories.push(errorCat);

  const securityCat = await runSecurityCategory(tool, invoke, sensitive, opts.consentProbe);
  categories.push(securityCat);

  const status = rollup(categories);

  return {
    tool,
    status,
    categories,
    durationMs: Math.round(performance.now() - start),
    generatedAt: startedAt,
  };
}

/** Validate many tools in parallel (bounded). */
export async function validateAll(
  tools: ToolDescriptor[],
  opts: ValidationOptions = {},
  concurrency = 4,
): Promise<ToolReport[]> {
  const out: ToolReport[] = [];
  for (let i = 0; i < tools.length; i += concurrency) {
    const batch = tools.slice(i, i + concurrency);
    out.push(...(await Promise.all(batch.map((t) => validateTool(t, opts)))));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Category implementations
// ---------------------------------------------------------------------------

/** 1. Schema: valid + complete + compilable JSON Schema. */
function runSchemaCategory(tool: ToolDescriptor): CategoryResult {
  const checks: Check[] = [];
  const start = performance.now();
  const schema = tool.inputSchema;

  const hasSchema: Check = {
    id: 'schema.declared',
    label: 'Declares an inputSchema',
    status: 'pass',
  };
  if (!schema) {
    hasSchema.status = 'fail';
    hasSchema.message = 'No inputSchema declared — agents cannot validate calls.';
    hasSchema.fix = 'Add `inputSchema` (JSON Schema object) to registerTool().';
  } else {
    hasSchema.message = 'inputSchema present.';
  }
  checks.push(hasSchema);

  if (schema) {
    const typeCheck: Check = {
      id: 'schema.type',
      label: 'Top-level type declared',
      status: 'pass',
    };
    if (!schema.type) {
      typeCheck.status = 'warn';
      typeCheck.message = 'No top-level `type` — ambiguous to some agents.';
      typeCheck.fix = 'Set `type: "object"` at the schema root.';
    }
    checks.push(typeCheck);

    const required: Check = {
      id: 'schema.required',
      label: 'Required fields declared',
      status: 'pass',
    };
    if (!schema.required) {
      required.status = 'warn';
      required.message = 'No `required` array — all params are optional.';
      required.fix = 'Mark mandatory params in `required: [...]`.';
    }
    checks.push(required);

    // Compilability via AJV.
    const compile: Check = {
      id: 'schema.compilable',
      label: 'Compiles in AJV',
      status: 'pass',
    };
    try {
      const ajv = new Ajv({ allErrors: true, strict: false });
      addFormats(ajv);
      ajv.compile(schema as any);
    } catch (err) {
      compile.status = 'fail';
      compile.message = `Schema does not compile: ${err instanceof Error ? err.message : String(err)}`;
      compile.fix = 'Fix the schema so it is valid draft-07 JSON Schema.';
    }
    checks.push(compile);

    const desc: Check = {
      id: 'schema.property-descriptions',
      label: 'Properties have descriptions',
      status: 'pass',
    };
    const props = schema.properties as Record<string, { description?: string }> | undefined;
    if (props) {
      const missing = Object.entries(props)
        .filter(([, p]) => !p?.description)
        .map(([k]) => k);
      if (missing.length) {
        desc.status = 'warn';
        desc.message = `Properties missing descriptions: ${missing.join(', ')}`;
        desc.fix = 'Add a `description` to each property — improves agent accuracy.';
      }
    }
    checks.push(desc);
  }

  return finalize('schema', 'Schema', checks, start);
}

/** 2. Parameter: generated inputs are accepted/rejected correctly. */
async function runParameterCategory(
  tool: ToolDescriptor,
  inputs: { label: string; input: JsonObject; expectOk: boolean }[],
  invoke: InvokeFn,
  timeoutMs: number,
): Promise<CategoryResult> {
  const checks: Check[] = [];
  const start = performance.now();

  for (const { label, input, expectOk } of inputs) {
    const check: Check = {
      id: `parameter.${label}`,
      label: `Input: ${label}`,
      status: 'pass',
    };
    try {
      await withTimeout(invoke(tool.name, input), timeoutMs);
      if (!expectOk) {
        check.status = 'fail';
        check.message = `Expected rejection for ${label}, but the tool accepted it.`;
        check.fix = 'Tighten inputSchema (add type/required/constraints) so invalid input is rejected.';
      }
    } catch (err) {
      if (expectOk) {
        check.status = 'fail';
        check.message = `Expected acceptance for ${label}, got error: ${messageOf(err)}`;
        check.fix = 'Loosen schema or ensure execute() handles valid input.';
      } else {
        check.status = 'pass';
      }
    }
    checks.push(check);
  }

  if (inputs.length === 0) {
    checks.push({
      id: 'parameter.no-schema',
      label: 'Parameter validation',
      status: 'warn',
      message: 'No inputSchema — cannot generate parameter tests.',
      fix: 'Declare an inputSchema to enable parameter tests.',
    });
  }

  return finalize('parameter', 'Parameters', checks, start);
}

/** 3. Execution: returns a JSON-serializable value. */
async function runExecutionCategory(
  tool: ToolDescriptor,
  invoke: InvokeFn,
  timeoutMs: number,
): Promise<CategoryResult> {
  const checks: Check[] = [];
  const start = performance.now();

  const valid = minimalValidInput(tool.inputSchema);
  const execCheck: Check = {
    id: 'execution.runs',
    label: 'Executes with valid input',
    status: 'pass',
  };
  let result: Json | undefined;
  try {
    result = await withTimeout(invoke(tool.name, valid), timeoutMs);
  } catch (err) {
    execCheck.status = 'fail';
    execCheck.message = `Execution failed: ${messageOf(err)}`;
    execCheck.fix = 'Ensure execute() does not throw for valid input.';
  }
  checks.push(execCheck);

  if (result !== undefined) {
    const serializable: Check = {
      id: 'execution.serializable',
      label: 'Output is JSON-serializable',
      status: 'pass',
    };
    try {
      JSON.stringify(result);
    } catch {
      serializable.status = 'fail';
      serializable.message = 'Output contains non-JSON values (function, symbol, circular ref).';
      serializable.fix = 'Return only JSON-compatible values from execute().';
    }
    checks.push(serializable);
  }

  return finalize('execution', 'Execution', checks, start);
}

/** 4. Error: bad input throws a descriptive error, not a crash. */
async function runErrorCategory(
  tool: ToolDescriptor,
  invoke: InvokeFn,
  timeoutMs: number,
): Promise<CategoryResult> {
  const checks: Check[] = [];
  const start = performance.now();

  const bad = { __invalid__: '<NOT_A_VALID_VALUE>', ...minimalValidInput(tool.inputSchema) };
  const errorCheck: Check = {
    id: 'error.handled',
    label: 'Rejects invalid input gracefully',
    status: 'pass',
  };
  try {
    await withTimeout(invoke(tool.name, bad), timeoutMs);
    // Accepting is allowed but suboptimal — warn, not fail.
    errorCheck.status = 'warn';
    errorCheck.message = 'Tool accepted clearly invalid input.';
    errorCheck.fix = 'Validate against inputSchema in execute() and throw on mismatch.';
  } catch (err) {
    const msg = messageOf(err);
    if (!msg || msg.length < 5) {
      errorCheck.status = 'warn';
      errorCheck.message = 'Tool rejected input but the error message is unhelpful.';
      errorCheck.fix = 'Throw descriptive Errors (e.g. "price must be a number").';
    }
  }
  checks.push(errorCheck);

  return finalize('error', 'Error handling', checks, start);
}

/** 5. Security: sensitive tools should request consent. */
async function runSecurityCategory(
  tool: ToolDescriptor,
  _invoke: InvokeFn,
  sensitive: string[],
  consentProbe?: ConsentProbe,
): Promise<CategoryResult> {
  const checks: Check[] = [];
  const start = performance.now();

  const isReadOnly = tool.annotations?.readOnlyHint === true;
  const text = `${tool.name} ${tool.description}`.toLowerCase();
  const flagged = sensitive.filter((k) => text.includes(k));

  const readonlyCheck: Check = {
    id: 'security.readonly-hint',
    label: 'readOnlyHint set appropriately',
    status: 'pass',
  };
  if (!isReadOnly && flagged.length === 0) {
    readonlyCheck.status = 'pass';
    readonlyCheck.message = 'Tool appears read-only — consider setting readOnlyHint: true.';
    readonlyCheck.fix = 'Add `annotations: { readOnlyHint: true }` if the tool only reads.';
  } else if (!isReadOnly && flagged.length > 0) {
    readonlyCheck.status = 'warn';
    readonlyCheck.message = `Sensitive keywords detected (${flagged.join(', ')}) but readOnlyHint not set — assumed mutating.`;
    readonlyCheck.fix = 'Confirm this is intentionally mutating; if so, call client.requestUserInteraction() before side effects.';
  }
  checks.push(readonlyCheck);

  const consentCheck: Check = {
    id: 'security.consent',
    label: 'Requests user consent for side effects',
    status: 'pass',
  };
  if (isReadOnly) {
    consentCheck.message = 'Read-only tool — consent not required.';
  } else if (consentProbe) {
    const probe = await runConsentSafely(consentProbe, tool.name, minimalValidInput(tool.inputSchema));
    if (probe.requested) {
      consentCheck.message = 'Tool correctly requests user interaction.';
    } else {
      consentCheck.status = 'fail';
      consentCheck.message = 'Mutating tool did not call client.requestUserInteraction().';
      consentCheck.fix = 'Before side effects, call `await client.requestUserInteraction("reason")` and abort if not granted.';
    }
  } else {
    consentCheck.status = 'warn';
    consentCheck.message = 'No consent probe wired — cannot verify consent flow.';
    consentCheck.fix = 'Run the validator with the consent probe enabled (Debugger mode).';
  }
  checks.push(consentCheck);

  return finalize('security', 'Security', checks, start);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Combine a category's checks into a single status (fail > warn > pass). */
function rollup(categories: CategoryResult[]): CheckStatus {
  if (categories.some((c) => c.status === 'fail')) return 'fail';
  if (categories.some((c) => c.status === 'warn')) return 'warn';
  return 'pass';
}

function finalize(
  id: CategoryResult['id'],
  label: string,
  checks: Check[],
  start: number,
): CategoryResult {
  const status = checks.some((c) => c.status === 'fail')
    ? 'fail'
    : checks.some((c) => c.status === 'warn')
      ? 'warn'
      : 'pass';
  return { id, label, status, checks, durationMs: Math.round(performance.now() - start) };
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms),
    ),
  ]);
}

async function runConsentSafely(
  probe: ConsentProbe,
  name: string,
  input: JsonObject,
): Promise<{ requested: boolean; granted?: boolean }> {
  try {
    return await probe(name, input);
  } catch {
    return { requested: false };
  }
}

/**
 * Generate valid/edge/invalid inputs from a schema. Used by the parameter
 * category. Conservative — never crashes on weird schemas.
 */
export function generateInputs(schema?: JsonSchema): { label: string; input: JsonObject; expectOk: boolean }[] {
  if (!schema) return [];
  const out: { label: string; input: JsonObject; expectOk: boolean }[] = [];
  const valid = minimalValidInput(schema);
  const required = Array.isArray(schema.required) ? (schema.required as string[]) : [];
  out.push({ label: 'valid', input: valid, expectOk: true });
  out.push({ label: 'empty-object', input: {}, expectOk: required.length === 0 });
  out.push({ label: 'null-for-string', input: withStringNull(schema), expectOk: false });
  out.push({ label: 'unicode-in-strings', input: withUnicode(valid), expectOk: true });
  return out;
}

/** Build the smallest input that satisfies a schema's required fields. */
export function minimalValidInput(schema?: JsonSchema): JsonObject {
  if (!schema) return {};
  const props = (schema.properties as Record<string, JsonSchema>) ?? {};
  const required = (schema.required as string[] | undefined) ?? [];
  const out: JsonObject = {};
  for (const key of required) {
    out[key] = defaultValue(props[key]);
  }
  return out;
}

function defaultValue(schema?: JsonSchema): Json {
  if (!schema) return '';
  switch (schema.type) {
    case 'string':
      return 'test';
    case 'number':
    case 'integer':
      return typeof schema.minimum === 'number' ? schema.minimum : 1;
    case 'boolean':
      return false;
    case 'array':
      return [];
    case 'object':
      return minimalValidInput(schema);
    default:
      return null;
  }
}

function withStringNull(schema: JsonSchema): JsonObject {
  const valid = minimalValidInput(schema);
  const props = (schema.properties as Record<string, JsonSchema>) ?? {};
  for (const [k, p] of Object.entries(props)) {
    if (p?.type === 'string') return { ...valid, [k]: null };
  }
  return { ...valid, __test: null };
}

function withUnicode(valid: JsonObject): JsonObject {
  // Edge: unicode + emoji often trips up naive handlers.
  const out: JsonObject = { ...valid };
  for (const k of Object.keys(out)) {
    if (typeof out[k] === 'string') out[k] = 'héllo 🦊世界';
  }
  return out;
}

/** Render a tool report as a Markdown document for export. */
export function reportToMarkdown(reports: ToolReport[]): string {
  const lines: string[] = ['# WebMCP Validation Report', ''];
  for (const r of reports) {
    lines.push(`## ${r.tool.name} — ${badge(r.status)}`);
    lines.push('');
    lines.push(`> ${r.tool.description || '_no description_'}`);
    lines.push('');
    lines.push(`- Source: \`${r.tool.source}\``);
    lines.push(`- Duration: ${r.durationMs}ms`);
    lines.push('');
    for (const cat of r.categories) {
      lines.push(`### ${cat.label} ${badge(cat.status)} (${cat.durationMs}ms)`);
      lines.push('');
      for (const c of cat.checks) {
        const mark = c.status === 'pass' ? '✅' : c.status === 'warn' ? '⚠️' : '❌';
        lines.push(`- ${mark} **${c.label}** — ${c.message ?? 'ok'}`);
        if (c.fix) lines.push(`  - _Fix:_ ${c.fix}`);
      }
      lines.push('');
    }
    lines.push('---');
    lines.push('');
  }
  return lines.join('\n');
}

function badge(s: CheckStatus): string {
  return s === 'pass' ? '✅ PASS' : s === 'warn' ? '⚠️ WARN' : '❌ FAIL';
}

/** Re-exported for callers that want the invocation result shape. */
export type { InvocationResult };
