import { useEffect, useMemo, useState } from 'react';
import { useSession, type ModuleId } from '../../store/session.js';

interface Cmd {
  id: string;
  label: string;
  hint: string;
  run: () => void;
}

/** Cmd+K command palette for module navigation + quick actions. */
export function CommandPalette() {
  const open = useSession((s) => s.commandPaletteOpen);
  const setOpen = useSession((s) => s.setCommandPalette);
  const setModule = useSession((s) => s.setModule);
  const toast = useSession((s) => s.toast);
  const setOverlay = useSession((s) => s.setOverlay);
  const overlay = useSession((s) => s.overlayEnabled);
  const clearEvents = useSession((s) => s.clearEvents);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const commands = useMemo<Cmd[]>(
    () => [
      { id: 'go-validator', label: 'Go to Validator', hint: 'Validate tools', run: () => setModule('validator') },
      { id: 'go-debugger', label: 'Go to Debugger', hint: 'Inspect live tools', run: () => setModule('debugger') },
      { id: 'go-sandbox', label: 'Go to Sandbox', hint: 'Simulate agents', run: () => setModule('sandbox') },
      { id: 'go-analytics', label: 'Go to Analytics', hint: 'Usage dashboard', run: () => setModule('analytics') },
      {
        id: 'toggle-overlay',
        label: overlay ? 'Hide DOM overlay' : 'Show DOM overlay',
        hint: 'Highlight declarative tools',
        run: () => {
          setOverlay(!overlay);
          toast('info', overlay ? 'Overlay hidden' : 'Overlay enabled');
        },
      },
      {
        id: 'clear-events',
        label: 'Clear timeline',
        hint: 'Reset the event log',
        run: () => {
          clearEvents();
          toast('success', 'Timeline cleared');
        },
      },
    ],
    [setModule, overlay, setOverlay, toast, clearEvents],
  );

  const filtered = useMemo(
    () => commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase())),
    [commands, query],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!open);
      }
      if (e.key === 'Escape' && open) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  if (!open) return null;

  const run = (c?: Cmd) => {
    if (!c) return;
    c.run();
    setOpen(false);
    setQuery('');
  };

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/60 flex items-start justify-center pt-[12vh] animate-fade-in"
      onClick={() => setOpen(false)}
    >
      <div
        className="panel w-full max-w-xl overflow-hidden shadow-glow"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          className="w-full bg-transparent px-4 py-3 text-sm outline-none border-b border-base-700 placeholder:text-base-500"
          placeholder="Type a command… (go to validator, toggle overlay, …)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, filtered.length - 1));
            if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
            if (e.key === 'Enter') run(filtered[active]);
          }}
        />
        <ul className="max-h-72 overflow-y-auto py-1">
          {filtered.map((c, i) => (
            <li
              key={c.id}
              className={`px-4 py-2 flex items-center justify-between cursor-pointer ${
                i === active ? 'bg-accent/15 text-white' : 'text-zinc-300'
              }`}
              onMouseEnter={() => setActive(i)}
              onClick={() => run(c)}
            >
              <span className="text-sm">{c.label}</span>
              <span className="text-2xs text-base-500">{c.hint}</span>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-4 py-3 text-sm text-base-500">No matching commands.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

export type { ModuleId };
