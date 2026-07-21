/**
 * Web session store — the chrome-free equivalent of the extension's session
 * store. Holds module selection, the active backend, and UI state (toasts,
 * command palette, snapshots). Tools + events come FROM the backend, not stored
 * here, so switching backends (inline → demo → url) is clean.
 */

import { create } from 'zustand';
import type { McpEvent, ToolDescriptor, ToolReport } from '@kitkat/core';
import type { ToastItem } from '@kitkat/ui';

export type ModuleId = 'playground' | 'validator' | 'debugger' | 'sandbox' | 'analytics';

interface WebState {
  activeModule: ModuleId;
  setModule: (m: ModuleId) => void;

  // backend-derived (kept in sync by the WebApp subscription)
  tools: ToolDescriptor[];
  events: McpEvent[];
  reports: ToolReport[];
  setTools: (t: ToolDescriptor[]) => void;
  setEvents: (e: McpEvent[]) => void;
  pushEvent: (e: McpEvent) => void;
  setReports: (r: ToolReport[]) => void;
  clearEvents: () => void;

  snapshots: Record<string, McpEvent[]>;
  captureSnapshot: (name: string) => void;

  commandPaletteOpen: boolean;
  setCommandPalette: (open: boolean) => void;

  toasts: ToastItem[];
  toast: (tone: ToastItem['tone'], message: ToastItem['message']) => void;
  dismissToast: (id: string) => void;
}

export const useWebSession = create<WebState>((set, get) => ({
  activeModule: 'validator',
  setModule: (m) => set({ activeModule: m }),

  tools: [],
  events: [],
  reports: [],
  setTools: (t) => set({ tools: t }),
  setEvents: (e) => set({ events: e }),
  pushEvent: (e) =>
    set((s) => {
      const events = [...s.events, e];
      if (events.length > 5000) events.splice(0, events.length - 5000);
      return { events };
    }),
  setReports: (r) => set({ reports: r }),
  clearEvents: () => set({ events: [] }),

  snapshots: {},
  captureSnapshot: (name) => set((s) => ({ snapshots: { ...s.snapshots, [name]: [...s.events] } })),

  commandPaletteOpen: false,
  setCommandPalette: (open) => set({ commandPaletteOpen: open }),

  toasts: [],
  toast: (tone, message) => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    set((s) => ({ toasts: [...s.toasts, { id, tone, message }] }));
    setTimeout(() => get().dismissToast(id), 3500);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
