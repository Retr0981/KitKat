import { useState, type ReactNode } from 'react';

/**
 * Inline educational tooltip. WebMCP is new; the spec demands "inline
 * explanations teach WebMCP while using it." Wrap any term in <ConceptTooltip
 * term="inputSchema">…</ConceptTooltip> and it becomes a dotted underline that
 * reveals a short primer on hover/focus.
 */
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
      <span className="underline decoration-dotted decoration-accent/60 underline-offset-2 cursor-help">
        {children}
      </span>
      {open && (
        <span
          role="tooltip"
          className="absolute z-50 left-0 top-full mt-1 w-64 p-2 rounded-md bg-base-850 border border-base-600 text-xs text-zinc-300 shadow-glow animate-fade-in font-normal leading-relaxed"
        >
          <span className="block font-semibold text-accent-glow mb-0.5">{term}</span>
          {explain}
        </span>
      )}
    </span>
  );
}
