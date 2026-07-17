import { useState, type ReactNode } from 'react';

/** Underline-style segmented control. */
export function Tabs({
  tabs,
  defaultId,
  onChange,
  className = '',
}: {
  tabs: { id: string; label: ReactNode; icon?: ReactNode }[];
  defaultId?: string;
  onChange?: (id: string) => void;
  className?: string;
}) {
  const [active, setActive] = useState(defaultId ?? tabs[0]?.id);
  return (
    <div className={`flex items-center gap-1 border-b border-border-subtle ${className}`}>
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            onClick={() => {
              setActive(t.id);
              onChange?.(t.id);
            }}
            className={`relative px-3 py-2 text-sm font-medium transition-colors flex items-center gap-1.5
              ${on ? 'text-content-primary' : 'text-content-tertiary hover:text-content-secondary'}`}
          >
            {t.icon && <span className="text-xs opacity-80">{t.icon}</span>}
            {t.label}
            {on && (
              <span
                className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full"
                style={{ background: 'var(--accent)' }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
