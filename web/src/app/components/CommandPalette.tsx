import { useEffect, useState } from 'react';
import type { ModuleId } from '../store.js';

const ITEMS: { id: ModuleId | 'editor'; label: string; hint: string }[] = [
  { id: 'editor', label: 'Go to Editor', hint: 'Define WebMCP tools' },
  { id: 'playground', label: 'Go to Playground', hint: 'Invoke tools Postman-style' },
  { id: 'validator', label: 'Go to Validator', hint: 'Test tools' },
  { id: 'debugger', label: 'Go to Debugger', hint: 'Inspect live tools' },
  { id: 'sandbox', label: 'Go to Sandbox', hint: 'Simulate agents' },
  { id: 'analytics', label: 'Go to Analytics', hint: 'Usage dashboard' },
];

/** Cmd+K command palette for module navigation. */
export function CommandPalette({ onClose, onNavigate }: { onClose: () => void; onNavigate: (m: ModuleId | 'editor') => void }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const filtered = ITEMS.filter((i) => i.label.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const go = (id?: ModuleId | 'editor') => {
    if (!id) return;
    onNavigate(id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-start justify-center pt-[14vh] animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-xl overflow-hidden rounded-lg bg-surface-1 border border-border-default shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, filtered.length - 1));
            if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
            if (e.key === 'Enter') go(filtered[active]?.id);
          }}
          placeholder="Jump to… (editor, validator, debugger, …)"
          className="w-full bg-transparent px-4 py-3.5 text-sm outline-none border-b border-border-subtle placeholder:text-content-muted"
        />
        <ul className="max-h-72 overflow-y-auto py-1">
          {filtered.map((item, i) => (
            <li
              key={item.id}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(item.id)}
              className={`px-4 py-2.5 flex items-center justify-between cursor-pointer ${i === active ? 'bg-accent-soft text-content-primary' : 'text-content-secondary'}`}
            >
              <span className="text-sm">{item.label}</span>
              <span className="text-2xs text-content-muted">{item.hint}</span>
            </li>
          ))}
          {filtered.length === 0 && <li className="px-4 py-3.5 text-sm text-content-muted">No matches.</li>}
        </ul>
      </div>
    </div>
  );
}
