import type { Config } from 'tailwindcss';

/**
 * KitKat Tailwind theme — a dark-first, Chrome DevTools / Postman aesthetic.
 * Semantic color tokens (surface/border/status) are used in components so the
 * theme can be retuned in one place.
 */
export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Surfaces (zinc-ish, slightly blue for the DevTools feel).
        base: {
          950: '#0a0c10',
          900: '#0f1218',
          850: '#141821',
          800: '#1a1f2b',
          700: '#252b39',
          600: '#323a4a',
          500: '#454f63',
        },
        // Accent — electric indigo.
        accent: {
          DEFAULT: '#6366f1',
          soft: '#818cf8',
          glow: '#a5b4fc',
        },
        // Status palette (spec: green/red/yellow/blue).
        ok: '#22c55e',
        bad: '#ef4444',
        warn: '#eab308',
        info: '#3b82f6',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(99,102,241,0.4), 0 0 20px rgba(99,102,241,0.25)',
      },
      animation: {
        'pulse-soft': 'pulse-soft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fade-in 0.15s ease-out',
      },
      keyframes: {
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(2px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
