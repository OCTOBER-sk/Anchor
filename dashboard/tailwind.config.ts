import type { Config } from 'tailwindcss';

/**
 * Anchor design tokens — locked per frontend.md §2.1.
 *
 * Colors are mapped to CSS variables declared in src/styles/globals.css as
 * space-separated RGB triplets (`:root` = warm-paper light, `.dark` = warm-paper
 * dark). Each utility resolves to `rgb(var(--token) / <alpha-value>)` so every
 * surface flips with the `.dark` class on <html> and opacity modifiers work
 * (`/50`, `/12`, …). These are the ONLY colors/fonts in the system. No additions.
 */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      bg: {
        base: 'rgb(var(--bg-base) / <alpha-value>)',
        raised: 'rgb(var(--bg-raised) / <alpha-value>)',
        sunken: 'rgb(var(--bg-sunken) / <alpha-value>)',
      },
      'text-primary': 'rgb(var(--text-primary) / <alpha-value>)',
      'text-secondary': 'rgb(var(--text-secondary) / <alpha-value>)',
      'text-tertiary': 'rgb(var(--text-tertiary) / <alpha-value>)',
      accent: {
        DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
        hover: 'rgb(var(--accent-hover) / <alpha-value>)',
        subtle: 'rgb(var(--accent-subtle) / <alpha-value>)',
      },
      border: {
        default: 'rgb(var(--border-default) / <alpha-value>)',
        strong: 'rgb(var(--border-strong) / <alpha-value>)',
        accent: 'rgb(var(--border-accent) / <alpha-value>)',
      },
      status: {
        success: 'rgb(var(--status-success) / <alpha-value>)',
        warning: 'rgb(var(--status-warning) / <alpha-value>)',
        error: 'rgb(var(--status-error) / <alpha-value>)',
      },
      code: {
        bg: 'rgb(var(--code-bg) / <alpha-value>)',
        text: 'rgb(var(--code-text) / <alpha-value>)',
        accent: 'rgb(var(--code-accent) / <alpha-value>)',
        string: 'rgb(var(--code-string) / <alpha-value>)',
      },
      /* Modal/scrim backdrop — the same near-black in both modes. */
      overlay: 'rgb(var(--overlay) / <alpha-value>)',
    },
    fontFamily: {
      display: ['Zodiak', 'Georgia', 'serif'],
      body: ['Switzer', 'Inter', 'system-ui', 'sans-serif'],
      mono: ['"JetBrains Mono"', '"Courier New"', 'monospace'],
    },
    extend: {
      /* 12% tint used by status badges/alert backgrounds (§2.4). */
      opacity: {
        12: '0.12',
      },
      fontSize: {
        'display-xl': ['3rem', { lineHeight: '1.1' }],
        'display-lg': ['2.25rem', { lineHeight: '1.15' }],
        'display-md': ['1.5rem', { lineHeight: '1.2' }],
        'body-lg': ['1.0625rem', { lineHeight: '1.6' }],
        'body-md': ['0.9375rem', { lineHeight: '1.6' }],
        'body-sm': ['0.875rem', { lineHeight: '1.5' }],
        'mono-md': ['0.875rem', { lineHeight: '1.5' }],
        'mono-sm': ['0.8125rem', { lineHeight: '1.4' }],
      },
      borderRadius: {
        card: '12px',
        control: '8px',
      },
    },
  },
  plugins: [],
} satisfies Config;
