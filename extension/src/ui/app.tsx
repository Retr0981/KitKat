import { useEffect } from 'react';
import { useSession, type ModuleId } from '../store/session.js';
import { subscribeStream, sendBg } from '../messaging/ports.js';
import { CommandPalette } from './components/CommandPalette.js';
import { Toaster } from './components/Toaster.js';
import { ValidatorModule } from './modules/validator/ValidatorModule.js';
import { DebuggerModule } from './modules/debugger/DebuggerModule.js';
import { SandboxModule } from './modules/sandbox/SandboxModule.js';
import { AnalyticsModule } from './modules/analytics/AnalyticsModule.js';

const MODULES: { id: ModuleId; label: string; icon: string; hint: string }[] = [
  { id: 'validator', label: 'Validator', icon: '✓', hint: 'Test tools before shipping' },
  { id: 'debugger', label: 'Debugger', icon: '⛏', hint: 'See what agents see' },
  { id: 'sandbox', label: 'Sandbox', icon: '⬡', hint: 'Simulate agents offline' },
  { id: 'analytics', label: 'Analytics', icon: '▦', hint: 'Usage & perf dashboards' },
];

/**
 * The KitKat app shell. Renders into the DevTools panel (primary), popup, and
 * side panel. Wires the streaming subscription to the session store on mount.
 */
export function App({ tabId }: { tabId?: number }) {
  const activeModule = useSession((s) => s.activeModule);
  const setModule = useSession((s) => s.setModule);
  const setTabId = useSession((s) => s.setTabId);
  const setTools = useSession((s) => s.setTools);
  const pushEvent = useSession((s) => s.pushEvent);

  // Resolve + track the active tab, and subscribe to its event stream.
  useEffect(() => {
    let resolvedTabId = tabId ?? null;
    (async () => {
      if (resolvedTabId == null) {
        const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
        resolvedTabId = t?.id ?? null;
      }
      if (resolvedTabId == null) return;
      setTabId(resolvedTabId);
      // Seed with whatever the background already has.
      try {
        const res = await sendBg({ kind: 'ui:get-tools', tabId: resolvedTabId });
        setTools(res.tools);
        const ev = await sendBg({ kind: 'ui:get-events', tabId: resolvedTabId });
        ev.events.forEach(pushEvent);
      } catch {
        /* background may be mid-startup; stream will catch up */
      }
      const unsub = subscribeStream(resolvedTabId, {
        onEvent: pushEvent,
        onTools: setTools,
      });
      return unsub;
    })();
  }, [tabId, setTabId, setTools, pushEvent]);

  return (
    <div className="h-full flex flex-col bg-base-950">
      <header className="flex items-center gap-1 px-2 h-11 border-b border-base-700 bg-base-900 shrink-0">
        <div className="flex items-center gap-2 pr-3 mr-1 border-r border-base-700">
          <span className="text-accent font-bold text-base tracking-tight">KitKat</span>
        </div>
        <nav className="flex items-center gap-0.5">
          {MODULES.map((m) => (
            <button
              key={m.id}
              onClick={() => setModule(m.id)}
              title={m.hint}
              className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 transition-colors ${
                activeModule === m.id
                  ? 'bg-accent/15 text-white border border-accent/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-base-800 border border-transparent'
              }`}
            >
              <span className="text-xs opacity-80">{m.icon}</span>
              {m.label}
            </button>
          ))}
        </nav>
        <div className="flex-1" />
        <kbd className="text-2xs text-base-500 font-mono">⌘K</kbd>
      </header>

      <main className="flex-1 min-h-0">
        {activeModule === 'validator' && <ValidatorModule />}
        {activeModule === 'debugger' && <DebuggerModule />}
        {activeModule === 'sandbox' && <SandboxModule />}
        {activeModule === 'analytics' && <AnalyticsModule />}
      </main>

      <CommandPalette />
      <Toaster />
    </div>
  );
}
