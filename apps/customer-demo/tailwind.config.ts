import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        joola: {
          black: '#0A0A0A',
          ink: '#1E1E1E',
          graphite: '#3A3A3A',
          stone: '#6B6B6B',
          mist: '#B8B8B8',
          fog: '#E5E5E5',
          paper: '#F5F4F1',
          white: '#FFFFFF',
          yellow: '#F5E625',
          'yellow-deep': '#D9CB1F',
          'yellow-soft': '#FFF4A8',
          red: '#D6182A',
          'red-deep': '#A30E1E',
          'court-blue': '#0B2A4A',
          sky: '#2C7AD6',
          'court-green': '#2E7D5B',
        },
        // semantic
        accent: '#F5E625',
        'accent-hover': '#D9CB1F',
        success: '#2E7D5B',
        warning: '#E07A1F',
        danger: '#D6182A',
      },
      fontFamily: {
        display: ['"Archivo Black"', 'Archivo', 'system-ui', 'sans-serif'],
        sans: ['Archivo', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', '"SF Mono"', 'Menlo', 'monospace'],
      },
      fontSize: {
        // mirror the modular 1.25 scale from the JOOLA tokens
        xs: ['12px', { lineHeight: '1.45' }],
        sm: ['14px', { lineHeight: '1.45' }],
        base: ['16px', { lineHeight: '1.45' }],
        md: ['18px', { lineHeight: '1.45' }],
        lg: ['22px', { lineHeight: '1.2' }],
        xl: ['28px', { lineHeight: '1.2' }],
        '2xl': ['36px', { lineHeight: '1.2' }],
        '3xl': ['48px', { lineHeight: '1.05' }],
        '4xl': ['64px', { lineHeight: '1.05' }],
      },
      letterSpacing: {
        tight: '-0.02em',
        wide: '0.04em',
        mega: '0.12em',
      },
      borderRadius: {
        none: '0',
        xs: '2px',
        sm: '4px',
        DEFAULT: '8px',
        pill: '999px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0,0,0,.06)',
        md: '0 4px 12px rgba(0,0,0,.10)',
        lg: '0 14px 40px rgba(0,0,0,.18)',
        'yellow-glow': '0 0 0 4px rgba(245,230,37,.35)',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(.2,.7,.1,1)',
      },
    },
  },
  plugins: [],
};

export default config;
