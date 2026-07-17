import type { CSSProperties, ReactNode } from 'react';

/** Surface container — the base building block for cards, panes, sections. */
export function Panel({
  children,
  className = '',
  raised,
  hover,
  onClick,
  style,
}: {
  children: ReactNode;
  className?: string;
  raised?: boolean;
  hover?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-lg border border-border-subtle
        bg-surface-1 ${raised ? 'shadow-md' : ''} ${hover ? 'transition-colors hover:border-border-default cursor-pointer' : ''} ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

/** Panel with a header row — title + optional actions + body. */
export function TitledPanel({
  title,
  subtitle,
  actions,
  children,
  className = '',
  bodyClassName = '',
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Panel className={`overflow-hidden ${className}`}>
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border-subtle bg-surface-2">
        <div className="min-w-0">
          <div className="text-sm font-medium text-content-primary truncate">{title}</div>
          {subtitle && <div className="text-xs text-content-tertiary truncate">{subtitle}</div>}
        </div>
        {actions && <div className="ml-auto flex items-center gap-1.5">{actions}</div>}
      </div>
      <div className={`p-3.5 ${bodyClassName}`}>{children}</div>
    </Panel>
  );
}
