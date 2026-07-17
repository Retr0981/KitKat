import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'text-white border-transparent shadow-sm',
  secondary:
    'bg-surface-2 hover:bg-surface-3 text-content-primary border-border-default',
  ghost:
    'bg-transparent hover:bg-surface-2 text-content-secondary hover:text-content-primary border-transparent',
  danger:
    'bg-bad hover:brightness-110 text-white border-transparent shadow-sm',
};

const SIZES: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1.5 rounded-sm',
  md: 'h-9 px-3.5 text-sm gap-2 rounded',
  lg: 'h-11 px-5 text-sm gap-2 rounded',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  loading?: boolean;
}

/** Primary action button. The redesigned replacement for the `.btn` class. */
export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  loading,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center font-medium whitespace-nowrap transition-all duration-150
        disabled:opacity-40 disabled:pointer-events-none select-none
        active:scale-[0.97] ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      style={
        variant === 'primary'
          ? { background: 'var(--accent)', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }
          : undefined
      }
      onMouseEnter={(e) => {
        if (variant === 'primary' && !disabled) {
          e.currentTarget.style.background = 'var(--accent-hover)';
        }
      }}
      onMouseLeave={(e) => {
        if (variant === 'primary') {
          e.currentTarget.style.background = 'var(--accent)';
        }
      }}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span
          className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full"
          style={{ animation: 'kitkat-spin 0.6s linear infinite' }}
        />
      ) : (
        icon && <span className="inline-flex shrink-0">{icon}</span>
      )}
      {children}
    </button>
  );
}
