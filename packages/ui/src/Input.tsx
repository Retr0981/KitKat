import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';

const base =
  'w-full bg-surface-2 border border-border-default rounded text-sm text-content-primary placeholder:text-content-muted transition-colors focus:outline-none focus:border-accent focus:ring-2 focus:ring-indigo-500/25';

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${base} h-9 px-3 ${className}`} {...rest} />;
}

export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${base} px-3 py-2 font-mono text-xs leading-relaxed ${className}`} {...rest} />;
}

export function Select({
  className = '',
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select
      className={`${base} h-9 px-2.5 appearance-none cursor-pointer ${className}`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 0.6rem center',
        paddingRight: '1.75rem',
      }}
      {...rest}
    >
      {children}
    </select>
  );
}

/** Field wrapper — label + control + optional hint. */
export function Field({
  label,
  hint,
  children,
  className = '',
}: {
  label?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      {label && <span className="text-xs font-medium text-content-secondary">{label}</span>}
      {children}
      {hint && <span className="text-[0.7rem] text-content-muted">{hint}</span>}
    </label>
  );
}
