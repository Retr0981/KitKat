import type { CheckStatus } from '@kitkat/core';

const MAP: Record<string, string> = {
  pass: 'badge-pass',
  fail: 'badge-fail',
  warn: 'badge-warn',
  info: 'badge-info',
  success: 'badge-pass',
  error: 'badge-fail',
  warning: 'badge-warn',
  available: 'badge-info',
  invoked: 'badge-info',
  executing: 'badge-warn',
  completed: 'badge-pass',
};

/** Color-coded status chip used throughout the app. */
export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const cls = MAP[status] ?? 'badge-info';
  return <span className={`badge ${cls}`}>{label ?? status}</span>;
}

export type { CheckStatus };
