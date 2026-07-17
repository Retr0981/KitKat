import type { ReactNode } from 'react';

/** Empty-state placeholder — icon, title, body, optional action. */
export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-3 animate-fade-in">
        {icon && <div className="text-4xl opacity-80">{icon}</div>}
        <h3 className="text-base font-semibold text-content-primary">{title}</h3>
        {children && <div className="text-sm text-content-tertiary leading-relaxed">{children}</div>}
        {action && <div className="pt-2 flex items-center justify-center gap-2">{action}</div>}
      </div>
    </div>
  );
}

/** Spinner. */
export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      className="inline-block border-2 border-current border-t-transparent rounded-full"
      style={{ width: size, height: size, animation: 'kitkat-spin 0.6s linear infinite' }}
    />
  );
}

/** Keyboard key cap. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex items-center px-1.5 h-5 rounded border border-border-default bg-surface-3 text-[0.65rem] font-mono font-medium text-content-secondary shadow-sm">
      {children}
    </kbd>
  );
}

/** Status pill with a colored dot — for connection / source indicators. */
export function StatusPill({ tone, children }: { tone: 'ok' | 'warn' | 'bad' | 'neutral'; children: ReactNode }) {
  const color =
    tone === 'ok' ? 'var(--ok)' : tone === 'warn' ? 'var(--warn)' : tone === 'bad' ? 'var(--bad)' : 'var(--text-tertiary)';
  return (
    <span className="inline-flex items-center gap-1.5 px-2 h-6 rounded-full bg-surface-2 border border-border-subtle text-xs text-content-secondary">
      <span className="relative flex w-1.5 h-1.5">
        <span className="absolute inset-0 rounded-full opacity-60" style={{ background: color, animation: 'kitkat-pulse 2s infinite' }} />
        <span className="relative inline-flex w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      </span>
      {children}
    </span>
  );
}
