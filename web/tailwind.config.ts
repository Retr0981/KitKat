import type { Config } from 'tailwindcss';

/**
 * KitKat Tailwind config.
 *
 * Design tokens are exposed as CSS variables by @kitkat/ui (theme.css) AND
 * mirrored here as theme colors so utilities like `bg-surface-0`, `text-primary`,
 * `border-default`, `bg-accent` Just Work. This is more reliable than arbitrary
 * values (`bg-[var(--surface-0)]`) and makes the design system first-class.
 *
 * IMPORTANT: the `rgb(<value> / <alpha>)` form lets Tailwind apply opacity
 * modifiers (e.g. `bg-accent/15`). The CSS var must therefore hold the raw
 * channel triplet — but since our tokens are full color values, we instead use
 * the `<value>` form (no alpha) and accept that opacity modifiers won't apply.
 * Where we need translucency we use the dedicated `*-soft` tokens.
 */
function v(token: string) {
  return `var(${token})`;
}

export default {
  content: [
    './src/**/*.{ts,tsx,html}',
    '../packages/ui/src/**/*.{ts,tsx}',
    '../packages/core/src/**/*.ts',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Surfaces
        'surface-0': v('--surface-0'),
        'surface-1': v('--surface-1'),
        'surface-2': v('--surface-2'),
        'surface-3': v('--surface-3'),
        'surface-4': v('--surface-4'),
        // Borders
        'border-subtle': v('--border-subtle'),
        'border-default': v('--border-default'),
        'border-strong': v('--border-strong'),
        // Text
        'content-primary': v('--text-primary'),
        'content-secondary': v('--text-secondary'),
        'content-tertiary': v('--text-tertiary'),
        'content-muted': v('--text-muted'),
        // Accent + status
        accent: {
          DEFAULT: v('--accent'),
          hover: v('--accent-hover'),
          soft: v('--accent-soft'),
          glow: v('--accent-glow'),
        },
        teal: v('--teal'),
        ok: { DEFAULT: v('--ok'), soft: v('--ok-soft') },
        bad: { DEFAULT: v('--bad'), soft: v('--bad-soft') },
        warn: { DEFAULT: v('--warn'), soft: v('--warn-soft') },
        info: { DEFAULT: v('--info'), soft: v('--info-soft') },
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '1rem' }],
      },
      maxWidth: {
        content: '72rem',
      },
      borderRadius: {
        DEFAULT: v('--radius'),
        sm: v('--radius-sm'),
        lg: v('--radius-lg'),
        xl: v('--radius-lg'),
        '2xl': '16px',
      },
      boxShadow: {
        sm: v('--shadow-sm'),
        md: v('--shadow-md'),
        lg: v('--shadow-lg'),
        glow: v('--shadow-glow'),
      },
    },
  },
  plugins: [],
} satisfies Config;
