import type { JsonObject, PersonaId, TestingTool } from '@kitkat/core';

/** A Sandbox scenario: a mock page's tools + an agent goal. */
export interface Scenario {
  id: string;
  name: string;
  tools: TestingTool[];
  params?: Record<string, JsonObject>;
  goal: string;
  persona: PersonaId;
  builtin?: boolean;
}

const DB_KEY = 'kitkat.sandbox.scenarios';

/** Persists user scenarios to localStorage (lightweight; IndexedDB optional). */
export class ScenarioStore {
  list(): Scenario[] {
    try {
      return JSON.parse(localStorage.getItem(DB_KEY) ?? '[]');
    } catch {
      return [];
    }
  }
  create(name: string): Scenario {
    const s: Scenario = {
      id: `scn_${Date.now().toString(36)}`,
      name,
      tools: [],
      goal: '',
      persona: 'custom',
    };
    const all = this.list();
    all.push(s);
    localStorage.setItem(DB_KEY, JSON.stringify(all));
    return s;
  }
  save(scn: Scenario): void {
    const all = this.list().filter((s) => s.id !== scn.id);
    all.push(scn);
    localStorage.setItem(DB_KEY, JSON.stringify(all));
  }
  remove(id: string): void {
    localStorage.setItem(DB_KEY, JSON.stringify(this.list().filter((s) => s.id !== id)));
  }
}
