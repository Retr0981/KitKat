/**
 * Agent engine — a rule-based, no-AI WebMCP agent that drives the 5-step
 * workflow in the Sandbox: discover → select → fill → invoke → respond → decide.
 *
 * The goal: simulate what a model would do given a page's tools and a goal,
 * deterministically, so contributors can author and test scenarios offline.
 *
 * Selection is keyword-matching between the goal and tool descriptions. Parameter
 * filling maps the tool's required fields to values in the scenario's `params`
 * map (falling back to schema-aware defaults). The "decide next" step picks the
 * next tool whose preconditions match the current state, stopping when no tool
 * advances the goal.
 */

import type { InvocationResult, JsonObject, Json, TestingTool, ToolDescriptor } from './types.js';

/** Built-in agent personas, also used by the Debugger to format tool lists. */
export type PersonaId = 'gemini' | 'claude' | 'gpt' | 'shopper' | 'travel' | 'support' | 'custom';

export interface Persona {
  id: PersonaId;
  label: string;
  /** System-prompt-flavored description of how the agent reasons. */
  systemPrompt: string;
  /** Keywords the agent favors when selecting tools. */
  favoredKeywords: string[];
}

export const PERSONAS: Record<PersonaId, Persona> = {
  gemini: {
    id: 'gemini',
    label: 'Gemini (function calling)',
    systemPrompt: 'You call tools via structured function declarations.',
    favoredKeywords: ['search', 'get', 'list', 'show'],
  },
  claude: {
    id: 'claude',
    label: 'Claude (tool use)',
    systemPrompt: 'You select tools to help answer the user, then reason about the result.',
    favoredKeywords: ['read', 'find', 'summarize', 'explain'],
  },
  gpt: {
    id: 'gpt',
    label: 'GPT (function calling)',
    systemPrompt: 'You emit a function_call with strict JSON arguments.',
    favoredKeywords: ['create', 'update', 'search'],
  },
  shopper: {
    id: 'shopper',
    label: 'Shopping assistant',
    systemPrompt: 'You help the user find and buy products.',
    favoredKeywords: ['product', 'cart', 'search', 'add', 'buy', 'price'],
  },
  travel: {
    id: 'travel',
    label: 'Travel booker',
    systemPrompt: 'You search and book flights and hotels.',
    favoredKeywords: ['flight', 'hotel', 'book', 'search', 'trip'],
  },
  support: {
    id: 'support',
    label: 'Support bot',
    systemPrompt: 'You look up orders and answer questions.',
    favoredKeywords: ['order', 'status', 'help', 'contact'],
  },
  custom: {
    id: 'custom',
    label: 'Custom agent',
    systemPrompt: 'You pursue the configured goal.',
    favoredKeywords: [],
  },
};

/** One reasoning step the agent takes. */
export interface AgentStep {
  /** Which of the 5 phases: discover | select | fill | invoke | respond | decide. */
  phase: 'discover' | 'select' | 'fill' | 'invoke' | 'respond' | 'decide';
  at: number;
  /** Human-readable narration of the reasoning. */
  narration: string;
  /** The tool selected, for select/fill/invoke/respond steps. */
  toolName?: string;
  /** The input the agent built, for fill/invoke steps. */
  input?: JsonObject;
  /** The result, for invoke/respond steps. */
  result?: InvocationResult;
  /** The agent's decision about the next step, for decide steps. */
  decision?: 'continue' | 'done' | 'stuck';
}

/** Inputs to a simulation run. */
export interface SimulationInput {
  persona: PersonaId;
  /** Natural-language goal, e.g. "find a red dress and add it to cart". */
  goal: string;
  /** Tools available on the mock page. */
  tools: TestingTool[];
  /** Per-tool parameter hints (tool name → field → value). */
  params?: Record<string, JsonObject>;
  /** Invoker used for the invoke phase. */
  invoke: (name: string, input: JsonObject) => Promise<Json>;
  /** Max steps before forcing a stop. Default 12. */
  maxSteps?: number;
}

/** The result of a simulation run. */
export interface SimulationResult {
  persona: PersonaId;
  goal: string;
  steps: AgentStep[];
  outcome: 'success' | 'partial' | 'stuck';
  /** Tools the agent invoked, in order. */
  invoked: string[];
}

/**
 * Run a deterministic 5-step agent simulation. Returns the full step trace so
 * the Sandbox can render the decision tree.
 */
export async function runSimulation(input: SimulationInput): Promise<SimulationResult> {
  const persona = PERSONAS[input.persona] ?? PERSONAS.custom;
  const maxSteps = input.maxSteps ?? 12;
  const steps: AgentStep[] = [];
  const invoked: string[] = [];
  const lowerGoal = input.goal.toLowerCase();
  const goalKeywords = tokenize(lowerGoal);

  // Phase 1 — discover
  steps.push({
    phase: 'discover',
    at: Date.now(),
    narration: `Discovered ${input.tools.length} tool(s): ${input.tools.map((t) => t.name).join(', ') || 'none'}.`,
  });

  // Order tools by relevance to the goal (keyword overlap) + persona favorites.
  const ranked = rankTools(input.tools, goalKeywords, persona);

  let state: JsonObject = {};
  let hasGathered = false; // has the agent done a read-only gather yet?
  let outcome: SimulationResult['outcome'] = 'stuck';

  for (let i = 0; i < maxSteps && i < ranked.length; i++) {
    const tool = ranked[i];
    if (!tool) break;

    // Phase 2 — select
    steps.push({
      phase: 'select',
      at: Date.now(),
      toolName: tool.name,
      narration: `Selected "${tool.name}" — ${tool.description || 'no description'}.`,
    });

    // Phase 3 — fill
    const filled = fillParams(tool, input.params?.[tool.name], state, lowerGoal);
    steps.push({
      phase: 'fill',
      at: Date.now(),
      toolName: tool.name,
      input: filled,
      narration: `Filled ${Object.keys(filled).length ? JSON.stringify(filled) : '(no params)'} from goal + provided hints.`,
    });

    // Phase 4 — invoke
    const invokeStart = performance.now();
    let result: InvocationResult;
    try {
      const output = await input.invoke(tool.name, filled);
      result = {
        toolName: tool.name,
        input: filled,
        status: 'success',
        output,
        durationMs: Math.round(performance.now() - invokeStart),
        startedAt: Date.now(),
      };
    } catch (err) {
      result = {
        toolName: tool.name,
        input: filled,
        status: 'error',
        errorMessage: err instanceof Error ? err.message : String(err),
        durationMs: Math.round(performance.now() - invokeStart),
        startedAt: Date.now(),
      };
    }
    invoked.push(tool.name);
    steps.push({
      phase: 'invoke',
      at: Date.now(),
      toolName: tool.name,
      input: filled,
      result,
      narration: `Invoked "${tool.name}" → ${result.status} in ${result.durationMs}ms.`,
    });

    // Phase 5 — respond + decide
    state = mergeState(state, result.output);
    if (tool.annotations?.readOnlyHint) hasGathered = true;
    const goalMet = assessGoal(lowerGoal, tool, result, state, hasGathered);
    steps.push({
      phase: 'respond',
      at: Date.now(),
      toolName: tool.name,
      result,
      narration: respondNarration(tool, result, goalMet),
    });

    if (goalMet || i === ranked.length - 1) {
      const decision: AgentStep['decision'] = goalMet ? 'done' : 'stuck';
      steps.push({
        phase: 'decide',
        at: Date.now(),
        decision,
        narration: goalMet
          ? 'Goal satisfied — stopping.'
          : `Ran out of relevant tools without satisfying the goal.`,
      });
      outcome = goalMet ? 'success' : 'partial';
      break;
    } else {
      steps.push({
        phase: 'decide',
        at: Date.now(),
        decision: 'continue',
        narration: 'Goal not yet satisfied — trying the next tool.',
      });
    }
  }

  if (invoked.length === 0) outcome = 'stuck';
  else if (outcome === 'stuck') outcome = 'partial';

  return { persona: input.persona, goal: input.goal, steps, outcome, invoked };
}

/** Rank tools by keyword overlap with the goal + persona favorites. */
export function rankTools(
  tools: TestingTool[],
  goalKeywords: string[],
  persona: Persona,
): TestingTool[] {
  return [...tools].sort((a, b) => score(b) - score(a));

  function score(t: TestingTool): number {
    const text = `${t.name} ${t.description}`.toLowerCase();
    let s = 0;
    for (const k of goalKeywords) if (text.includes(k)) s += 2;
    for (const k of persona.favoredKeywords) if (text.includes(k)) s += 1;
    // A careful agent gathers information before acting: strongly prefer
    // read-only tools first when the goal hasn't named a mutation yet.
    if (t.annotations?.readOnlyHint) s += 3;
    return s;
  }
}

/** Build the input for a tool from hints, prior state, and goal-derived values. */
export function fillParams(
  tool: TestingTool,
  hints: JsonObject | undefined,
  state: JsonObject,
  goal: string,
): JsonObject {
  const props = (tool.inputSchema?.properties as Record<string, JsonSchemaLite>) ?? {};
  const required = new Set((tool.inputSchema?.required as string[] | undefined) ?? []);
  const out: JsonObject = {};
  // Fill every declared property the agent has a value for, not just required
  // ones — a good agent populates what it knows. Required fields always land.
  for (const key of Object.keys(props)) {
    const value = resolveValue(key, props[key], hints, state, goal);
    if (value !== undefined) {
      out[key] = value;
    } else if (required.has(key)) {
      out[key] = schemaDefault(props[key]);
    }
  }
  // Any required field with no property schema still gets a default.
  for (const key of required) {
    if (out[key] === undefined) out[key] = schemaDefault(props[key]);
  }
  return out;
}

/** Resolve a single parameter value from hints → state → goal → undefined. */
function resolveValue(
  key: string,
  schema: JsonSchemaLite | undefined,
  hints: JsonObject | undefined,
  state: JsonObject,
  goal: string,
): Json | undefined {
  if (hints && hints[key] !== undefined) return (hints as JsonObject)[key] as Json;
  if (state[key] !== undefined) return state[key] as Json;
  return guessFromGoal(goal, key, schema);
}

type JsonSchemaLite = { type?: string; enum?: unknown[]; minimum?: number };

function guessFromGoal(goal: string, key: string, schema?: JsonSchemaLite): Json | undefined {
  const k = key.toLowerCase();
  if (schema?.enum && schema.enum.length) return schema.enum[0] as Json;
  if (/color|colour/.test(k)) {
    const m = goal.match(/\b(red|blue|green|black|white|yellow|purple|pink|orange)\b/);
    if (m) return m[1];
  }
  if (/size/.test(k)) {
    const m = goal.match(/\b(xs|s|m|l|xl|small|medium|large)\b/);
    const size = m?.[1];
    if (size) {
      return size === 'small'
        ? 'S'
        : size === 'medium'
          ? 'M'
          : size === 'large'
            ? 'L'
            : size.toUpperCase();
    }
  }
  if (schema?.type === 'number' || schema?.type === 'integer') {
    const m = goal.match(/\b(\d{1,6})\b/);
    if (m) return Number(m[1]);
  }
  if (schema?.type === 'string') {
    const m = goal.match(new RegExp(`\\b\\w+\\s+${escapeRegex(k)}\\b`));
    if (m) return m[0];
  }
  return undefined;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function schemaDefault(schema?: JsonSchemaLite): Json {
  switch (schema?.type) {
    case 'string':
      return 'test';
    case 'number':
    case 'integer':
      return typeof schema.minimum === 'number' ? schema.minimum : 1;
    case 'boolean':
      return false;
    case 'array':
      return [];
    default:
      return '';
  }
}

function mergeState(state: JsonObject, output: Json | undefined): JsonObject {
  if (output && typeof output === 'object' && !Array.isArray(output)) {
    return { ...state, ...(output as JsonObject) };
  }
  return state;
}

/**
 * Heuristic: did this tool's output plausibly satisfy the goal?
 * A careful agent doesn't declare a mutation-goal met until it has gathered the
 * information needed to act (so "buy X" requires a prior "search/get X").
 */
function assessGoal(
  goal: string,
  tool: TestingTool,
  result: InvocationResult,
  _state: JsonObject,
  hasGathered: boolean,
): boolean {
  if (result.status !== 'success') return false;
  const isMutation = !tool.annotations?.readOnlyHint;
  const verbs = ['book', 'buy', 'purchase', 'add', 'create', 'submit', 'order', 'send'];
  const goalVerbMatch = verbs.some((v) => goal.includes(v) && tool.name.toLowerCase().includes(v));
  if (goalVerbMatch && isMutation && !hasGathered) {
    // Premature: the agent tried to act before gathering. Keep going.
    return false;
  }
  if (goalVerbMatch) return true;
  // Or the output explicitly claims success on a mutation.
  const out = result.output as JsonObject | undefined;
  if (out && isMutation && (out.ok === true || out.success === true || out.status === 'ok')) {
    return hasGathered;
  }
  return false;
}

function respondNarration(tool: TestingTool, result: InvocationResult, goalMet: boolean): string {
  if (result.status === 'success') {
    return goalMet
      ? `"${tool.name}" succeeded — the goal appears satisfied.`
      : `"${tool.name}" returned a result; checking whether more steps are needed.`;
  }
  return `"${tool.name}" failed: ${result.errorMessage ?? 'unknown error'}.`;
}

function tokenize(text: string): string[] {
  return text.split(/[^a-z0-9]+/i).filter((w) => w.length > 2);
}

// ---------------------------------------------------------------------------
// Debugger persona formatting — render tools as different LLMs see them
// ---------------------------------------------------------------------------

/** Render a tool list the way a given LLM persona would receive it. */
export function formatForPersona(persona: PersonaId, tools: ToolDescriptor[]): string {
  switch (persona) {
    case 'gemini':
    case 'gpt':
      return JSON.stringify(
        tools.map((t) => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: t.inputSchema ?? { type: 'object', properties: {} },
          },
        })),
        null,
        2,
      );
    case 'claude':
      return tools
        .map(
          (t) =>
            `Tool: ${t.name}\nDescription: ${t.description}\nInput schema:\n${JSON.stringify(t.inputSchema ?? {}, null, 2)}`,
        )
        .join('\n\n');
    default:
      return JSON.stringify(tools, null, 2);
  }
}
