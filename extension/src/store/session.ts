/**
 * Session store — the shared backbone for every module.
 *
 * Holds the active tab id, the live tool list, the streaming event timeline,
 * and the validator reports. Modules read from selectors and never mutate this
 * directly except through the actions below — keeping a single source of truth.
 */

import { create } from 'zustand';
import type { McpEvent, ToolDescriptor, ToolReport } from '@kitkat/core';

export type ModuleId = 'validator' | 'debugger' | 'sandbox' | 'analytics';

export interface Toast {
  id: string;
  severity: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

interface SessionState {
  // --- surface ---
  activeModule: ModuleId;
  activeTabId: number | null;
  commandPaletteOpen: boolean;

  // --- data ---
  tools: ToolDescriptor[];
  events: McpEvent[];
  reports: ToolReport[];
  /** Named freeze-frame snapshots of the timeline (Debugger feature). */
  snapshots: Record<string, McpEvent[]>;

  // --- ui ---
  toasts: Toast[];
  overlayEnabled: boolean;

  // --- actions ---
  setModule: (m: ModuleId) => void;
  setTabId: (id: number | null) => void;
  setTools: (tools: ToolDescriptor[]) => void;
  addTool: (tool: ToolDescriptor) => void;
  removeTool: (name: string) => void;
  pushEvent: (event: McpEvent) => void;
  clearEvents: () => void;
  setReports: (reports: ToolReport[]) => void;
  setOverlay: (enabled: boolean) => void;
  setCommandPalette: (open: boolean) => void;

  captureSnapshot: (name: string) => void;

  toast: (severity: Toast['severity'], message: string) => void;
  dismissToast: (id: string) => void;
}

const MAX_EVENTS = 5000;

export const useSession = create<SessionState>((set, get) => ({
  activeModule: 'validator',
  activeTabId: null,
  commandPaletteOpen: false,
  tools: [],
  events: [],
  reports: [],
  snapshots: {},
  toasts: [],
  overlayEnabled: false,

  setModule: (m) => set({ activeModule: m }),
  setTabId: (id) => set({ activeTabId: id }),
  setTools: (tools) => set({ tools }),
  addTool: (tool) =>
    set((s) => ({
      tools: s.tools.some((t) => t.name === tool.name)
        ? s.tools.map((t) => (t.name === tool.name ? tool : t))
        : [...s.tools, tool],
    })),
  removeTool: (name) => set((s) => ({ tools: s.tools.filter((t) => t.name !== name) })),
  pushEvent: (event) =>
    set((s) => {
      const events = [...s.events, event];
      if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
      // Derive tool state changes from events so the tool list stays live.
      let tools = s.tools;
      if (event.type === 'tool:registered') {
        tools = tools.some((t) => t.name === event.tool.name)
          ? tools.map((t) => (t.name === event.tool.name ? event.tool : t))
          : [...tools, event.tool];
      } else if (event.type === 'tool:unregistered') {
        tools = tools.filter((t) => t.name !== event.toolName);
      }
      return { events, tools };
    }),
  clearEvents: () => set({ events: [] }),
  setReports: (reports) => set({ reports }),
  setOverlay: (enabled) => set({ overlayEnabled: enabled }),
  setCommandPalette: (open) => set({ commandPaletteOpen: open }),
  captureSnapshot: (name) => set((s) => ({ snapshots: { ...s.snapshots, [name]: [...s.events] } })),

  toast: (severity, message) => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    set((s) => ({ toasts: [...s.toasts, { id, severity, message }] }));
    setTimeout(() => get().dismissToast(id), 3500);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
