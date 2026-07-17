import { useState, type ReactNode } from 'react';

/** Hover/focus tooltip. Generic, used for icons + labels. */
export function Tooltip({
  content,
  children,
  side = 'top',
}: {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom';
}) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className={`absolute z-50 left-1/2 -translate-x-1/2 ${
            side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          } w-max max-w-xs px-2.5 py-1.5 rounded bg-surface-3 border border-border-strong text-xs text-content-secondary shadow-md animate-fade-in pointer-events-none`}
        >
          {content}
        </span>
      )}
    </span>
  );
}

/** Inline educational tooltip for WebMCP concepts — dotted underline on the term. */
export function ConceptTooltip({
  term,
  children,
  explain,
}: {
  term: string;
  children: ReactNode;
  explain: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
    >
      <span className="underline decoration-dotted decoration-indigo-400/60 underline-offset-2 cursor-help">
        {children}
      </span>
      {open && (
        <span
          role="tooltip"
          className="absolute z-50 left-0 top-full mt-1 w-64 p-2.5 rounded bg-surface-3 border border-border-strong text-xs text-content-secondary leading-relaxed shadow-md animate-fade-in font-normal"
        >
          <span className="block font-semibold text-accent-glow mb-0.5">{term}</span>
          {explain}
        </span>
      )}
    </span>
  );
}
