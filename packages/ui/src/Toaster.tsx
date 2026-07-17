import type { ReactNode } from 'react';

export interface ToastItem {
  id: string;
  tone: 'ok' | 'bad' | 'warn' | 'info';
  message: ReactNode;
}

const ICONS: Record<ToastItem['tone'], string> = { ok: '✓', bad: '✕', warn: '⚠', info: 'ℹ' };
const BORDER: Record<ToastItem['tone'], string> = {
  ok: 'border-l-ok',
  bad: 'border-l-bad',
  warn: 'border-l-warn',
  info: 'border-l-info',
};

/** Bottom-right toast stack. Expects a toast store to feed it. */
export function Toaster({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 w-80 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => onDismiss(t.id)}
          className={`pointer-events-auto px-3.5 py-2.5 rounded bg-surface-2 border border-border-subtle border-l-2 ${BORDER[t.tone]} shadow-lg flex items-start gap-2.5 text-sm text-content-primary animate-slide-in cursor-pointer`}
        >
          <span className="font-mono font-bold text-xs mt-0.5 opacity-80">{ICONS[t.tone]}</span>
          <span className="flex-1">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
