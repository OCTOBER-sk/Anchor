import type { Config } from 'tailwindcss';

/**
 * Anchor design tokens — locked per frontend.md §2.1.
 * These are the ONLY colors/fonts in the system. No additions.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    colors: {
      bg: {
        base: '#FAF8F4',
        raised: '#F4F1EB',
        sunken: '#EFECE4',
      },
      'text-primary': '#1A1A18',
      'text-secondary': '#4A4A45',
      'text-tertiary': '#6E6E68',
      accent: {
        DEFAULT: '#1A6B4A',
        hover: '#155C3E',
        subtle: '#E8F4EE',
      },
      border: {
        default: '#E2DED5',
        strong: '#C8C4BB',
        accent: '#A8D4BC',
      },
      status: {
        success: '#1A6B4A',
        warning: '#B45309',
        error: '#B91C1C',
      },
      code: {
        bg: '#1C1C1A',
        text: '#E8E4DC',
        accent: '#5EC99A',
        string: '#D4A76A',
      },
    },
    fontFamily: {
      display: ['Zodiak', 'Georgia', 'serif'],
      body: ['Switzer', 'Inter', 'system-ui', 'sans-serif'],
      mono: ['"JetBrains Mono"', '"Courier New"', 'monospace'],
    },
    extend: {
      fontSize: {
        'display-xl': ['3.5rem', { lineHeight: '1.1' }],
        'display-lg': ['2.5rem', { lineHeight: '1.15' }],
        'display-md': ['1.75rem', { lineHeight: '1.2' }],
        'body-lg': ['1.125rem', { lineHeight: '1.6' }],
        'body-md': ['1rem', { lineHeight: '1.6' }],
        'body-sm': ['0.875rem', { lineHeight: '1.5' }],
        'mono-md': ['0.9375rem', { lineHeight: '1.5' }],
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
