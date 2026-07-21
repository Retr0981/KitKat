import { useSession } from '../../store/session.js';

const ICONS: Record<string, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};
const COLORS: Record<string, string> = {
  success: 'border-ok/40 text-ok',
  error: 'border-bad/40 text-bad',
  warning: 'border-warn/40 text-warn',
  info: 'border-info/40 text-info',
};

/** Stack of transient notifications, bottom-right. */
export function Toaster() {
  const toasts = useSession((s) => s.toasts);
  const dismiss = useSession((s) => s.dismissToast);
  return (
    <div className="fixed bottom-3 right-3 z-[100] flex flex-col gap-2 w-80">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`panel px-3 py-2 flex items-start gap-2 text-sm animate-fade-in ${COLORS[t.severity]}`}
          onClick={() => dismiss(t.id)}
        >
          <span className="font-mono font-bold">{ICONS[t.severity]}</span>
          <span className="text-zinc-200 flex-1">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
