import { useEffect, useState, type ReactNode } from 'react';
import { Kbd, StatusPill } from './Misc.js';

export interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
  hint: string;
  badge?: ReactNode;
}

/**
 * The redesigned KitKat application shell.
 *
 * A fixed left sidebar for module navigation, a top bar that surfaces the
 * active "source" (which page/scenario/inline tools are loaded) + a connection
 * pill, and a content region. The sidebar collapses to icons on narrow widths
 * (popup/side panel). The command palette is wired via ⌘K in the consumer.
 */
export function AppShell({
  nav,
  activeId,
  onSelect,
  topBarLeft,
  topBarRight,
  sourceLabel,
  sourceTone = 'ok',
  children,
  compact = false,
}: {
  nav: NavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  topBarLeft?: ReactNode;
  topBarRight?: ReactNode;
  sourceLabel?: ReactNode;
  sourceTone?: 'ok' | 'warn' | 'bad' | 'neutral';
  children: ReactNode;
  /** Compact = popup/side panel: icon-only rail, no labels. */
  compact?: boolean;
}) {
  const [paletteHint, setPaletteHint] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setPaletteHint(false), 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="h-full flex bg-surface-0">
      {/* Sidebar */}
      <aside
        className={`flex flex-col border-r border-border-subtle bg-surface-1 shrink-0 ${compact ? 'w-14' : 'w-52'}`}
      >
        <div className={`flex items-center gap-2 ${compact ? 'justify-center h-12' : 'px-4 h-14'} border-b border-border-subtle`}>
          <Logo />
          {!compact && (
            <span className="font-semibold text-content-primary tracking-tight">
              MCP<span className="text-accent">Kit</span>
            </span>
          )}
        </div>

        <nav className="flex-1 p-2 space-y-0.5">
          {nav.map((item) => {
            const on = item.id === activeId;
            return (
              <button
                key={item.id}
                onClick={() => onSelect(item.id)}
                title={item.hint}
                className={`w-full flex items-center gap-2.5 rounded text-sm font-medium transition-all relative group
                  ${compact ? 'justify-center h-10' : 'px-2.5 h-9'}
                  ${on ? 'text-content-primary' : 'text-content-tertiary hover:text-content-secondary hover:bg-surface-2'}`}
                style={on ? { background: 'var(--accent-soft)' } : undefined}
              >
                {on && (
                  <span
                    className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full"
                    style={{ background: 'var(--accent)' }}
                  />
                )}
                <span className={`text-base shrink-0 ${on ? 'text-accent' : ''}`}>{item.icon}</span>
                {!compact && <span className="flex-1 text-left truncate">{item.label}</span>}
                {!compact && item.badge}
              </button>
            );
          })}
        </nav>

        {!compact && (
          <div className="p-2 border-t border-border-subtle">
            <div className="flex items-center justify-between px-2.5 h-7 text-[0.7rem] text-content-muted">
              <span>Command palette</span>
              <span className="flex items-center gap-0.5">
                <Kbd>⌘</Kbd>
                <Kbd>K</Kbd>
              </span>
            </div>
          </div>
        )}
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-12 shrink-0 flex items-center gap-3 px-4 border-b border-border-subtle bg-surface-1">
          {topBarLeft}
          {sourceLabel && <StatusPill tone={sourceTone}>{sourceLabel}</StatusPill>}
          <div className="flex-1" />
          {topBarRight}
          {paletteHint && !compact && (
            <span className="text-[0.7rem] text-content-muted animate-fade-in">
              Press <Kbd>⌘K</Kbd> to navigate
            </span>
          )}
        </header>

        {/* Content */}
        <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <span
      className="inline-flex items-center justify-center w-7 h-7 rounded-sm text-white text-sm font-bold"
      style={{ background: 'linear-gradient(135deg, var(--accent), var(--teal))' }}
    >
      M
    </span>
  );
}
