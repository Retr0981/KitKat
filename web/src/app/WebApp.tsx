import { useEffect, useMemo, useState } from 'react';
import { AppShell, Toaster, type NavItem } from '@kitkat/ui';
import { useWebSession, type ModuleId } from './store.js';
import { BackendProvider } from './backend/context.js';
import { createInMemoryBackend, STARTER_TOOL, type InlineTool } from './backend/in-memory.js';
import { ValidatorPage } from './modules/ValidatorPage.js';
import { PlaygroundPage } from './modules/PlaygroundPage.js';
import { DebuggerPage } from './modules/DebuggerPage.js';
import { SandboxPage } from './modules/SandboxPage.js';
import { AnalyticsPage } from './modules/AnalyticsPage.js';
import { ToolEditor } from './modules/ToolEditor.js';
import { CommandPalette } from './components/CommandPalette.js';
import { SourceSwitcher } from './components/SourceSwitcher.js';

const NAV: (NavItem & { module: ModuleId | 'editor' })[] = [
  { id: 'editor', module: 'editor', label: 'Editor', icon: '✎', hint: 'Define WebMCP tools' },
  { id: 'playground', module: 'playground', label: 'Playground', icon: '⚡', hint: 'Invoke tools Postman-style' },
  { id: 'validator', module: 'validator', label: 'Validator', icon: '✓', hint: 'Test tools before shipping' },
  { id: 'debugger', module: 'debugger', label: 'Debugger', icon: '⛏', hint: 'See what agents see' },
  { id: 'sandbox', module: 'sandbox', label: 'Sandbox', icon: '⬡', hint: 'Simulate agents offline' },
  { id: 'analytics', module: 'analytics', label: 'Analytics', icon: '▦', hint: 'Usage & perf dashboards' },
];

/**
 * The hosted KitKat tool. Wires the in-memory backend (the always-works surface)
 * to the redesigned shell + modules. The source switcher lets the developer
 * also load demos / a URL via the iframe host backend.
 */
export function WebApp() {
  const [inlineTools, setInlineTools] = useState<InlineTool[]>([{ ...STARTER_TOOL }]);
  const [active, setActive] = useState<ModuleId | 'editor'>('playground');

  // The active backend. Created once and never replaced — the in-memory registry
  // is mutated in place by the editor. useState with an initializer avoids the
  // null-gymnastics of a ref and guarantees a stable, non-null instance.
  const [backend] = useState(() =>
    createInMemoryBackend(inlineTools, { consent: async (_n, msg) => confirm(msg) }),
  );
  const setTools = useWebSession((s) => s.setTools);
  const pushEvent = useWebSession((s) => s.pushEvent);
  const clearEvents = useWebSession((s) => s.clearEvents);
  const toasts = useWebSession((s) => s.toasts);
  const dismissToast = useWebSession((s) => s.dismissToast);
  const toast = useWebSession((s) => s.toast);
  const commandPaletteOpen = useWebSession((s) => s.commandPaletteOpen);
  const setCommandPalette = useWebSession((s) => s.setCommandPalette);

  // Subscribe the store to the backend's stream.
  useEffect(() => {
    setTools(backend.getTools());
    return backend.subscribe({
      onEvent: pushEvent,
      onTools: setTools,
    });
  }, [backend, setTools, pushEvent]);

  // ⌘K opens the command palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPalette(!useWebSession.getState().commandPaletteOpen);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setCommandPalette]);

  const sourceLabel = useMemo(() => {
    const n = backend.getTools().length;
    return `${backend.source.label} · ${n} tool${n === 1 ? '' : 's'}`;
  }, [backend, toasts]); // re-evaluate when toasts change (cheap proxy for tool changes)

  const nav: NavItem[] = NAV.map((n) => ({
    id: n.id,
    label: n.label,
    icon: n.icon,
    hint: n.hint,
  }));

  return (
    <BackendProvider backend={backend}>
      <div className="theme-dark h-full">
        <AppShell
          nav={nav}
          activeId={active}
          onSelect={(id) => setActive(id as ModuleId | 'editor')}
          sourceLabel={sourceLabel}
          sourceTone={backend.source.canInvoke ? 'ok' : 'warn'}
          topBarLeft={<SourceSwitcher />}
          topBarRight={
            <button
              onClick={() => clearEvents()}
              className="text-xs text-content-tertiary hover:text-content-secondary transition-colors"
            >
              clear timeline
            </button>
          }
        >
          {active === 'editor' && (
            <ToolEditor
              tools={inlineTools}
              onApply={(t) => {
                // Update the inline-tools state and the backend registry.
                setInlineTools((prev) => {
                  const exists = prev.some((x) => x.name === t.name);
                  return exists ? prev.map((x) => (x.name === t.name ? t : x)) : [...prev, t];
                });
                backend.upsertTool(t);
                toast('ok', `Registered "${t.name}"`);
              }}
              onRemove={(name) => {
                setInlineTools((prev) => prev.filter((x) => x.name !== name));
                backend.removeTool(name);
                toast('info', `Removed "${name}"`);
              }}
              onLoadStarter={() => {
                setInlineTools([{ ...STARTER_TOOL }]);
                backend.setTools([{ ...STARTER_TOOL }]);
                toast('info', 'Reset to starter tool');
              }}
            />
          )}
          {active === 'playground' && <PlaygroundPage />}
          {active === 'validator' && <ValidatorPage />}
          {active === 'debugger' && <DebuggerPage />}
          {active === 'sandbox' && <SandboxPage />}
          {active === 'analytics' && <AnalyticsPage />}
        </AppShell>
        <Toaster toasts={toasts} onDismiss={dismissToast} />
        {commandPaletteOpen && <CommandPalette onClose={() => setCommandPalette(false)} onNavigate={(m) => setActive(m)} />}
      </div>
    </BackendProvider>
  );
}
