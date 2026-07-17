import type { ReactNode } from 'react';

type Tone = 'neutral' | 'accent' | 'ok' | 'bad' | 'warn' | 'info';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-3 text-content-secondary border-border-default',
  accent: 'bg-accent-soft text-accent-glow border-indigo-400/40',
  ok: 'bg-ok-soft text-ok border-[var(--ok)]/30',
  bad: 'bg-bad-soft text-bad border-[var(--bad)]/30',
  warn: 'bg-warn-soft text-warn border-[var(--warn)]/30',
  info: 'bg-info-soft text-info border-[var(--info)]/30',
};

/** Compact status chip with a consistent tone system across the app. */
export function Badge({
  tone = 'neutral',
  children,
  className = '',
  dot,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[0.65rem] font-mono font-semibold uppercase tracking-wider border ${TONES[tone]} ${className}`}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/** Tone helper: map an arbitrary status string to a Badge tone. */
export function toneFor(status: string): Tone {
  switch (status) {
    case 'pass':
    case 'success':
    case 'completed':
    case 'ok':
      return 'ok';
    case 'fail':
    case 'error':
      return 'bad';
    case 'warn':
    case 'warning':
      return 'warn';
    case 'info':
    case 'available':
    case 'invoked':
      return 'info';
    default:
      return 'neutral';
  }
}
