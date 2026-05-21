import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/providers/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // OPS dark-theme tokens (resolve to CSS vars defined in globals.css)
        'ops-bg':       'var(--ops-bg)',
        'ops-panel':    'var(--ops-panel)',
        'ops-panel-2':  'var(--ops-panel-2)',
        'ops-panel-3': 'var(--ops-panel-3)',
        'ops-line':     'var(--ops-line)',
        'ops-line-2':  'var(--ops-line-2)',
        'ops-fg':       'var(--ops-fg)',
        'ops-fg-2':     'var(--ops-fg-2)',
        'ops-fg-3':     'var(--ops-fg-3)',
        'ops-fg-4':     'var(--ops-fg-4)',
        'ops-yellow':   'var(--ops-yellow)',
        'ops-red':     '#FF3A4C',
        'ops-green':   '#34C77B',
        'ops-blue':    '#4E9DFF',
        'ops-orange':  '#FF8A1F',
        'ops-purple':  '#B47CFF',

        // JOOLA brand
        'joola-yellow':       '#F5E625',
        'joola-yellow-deep':  '#D9CB1F',
        'joola-yellow-soft':  '#FFF4A8',
        'joola-black':        '#0A0A0A',
        'joola-ink':          '#1E1E1E',
        'joola-graphite':     '#3A3A3A',
        'joola-stone':        '#6B6B6B',
        'joola-mist':         '#B8B8B8',
        'joola-fog':          '#E5E5E5',
        'joola-paper':        '#F5F4F1',
        'joola-white':        '#FFFFFF',
        'joola-red':          '#D6182A',
        'joola-court-blue':   '#0B2A4A',
        'joola-sky':          '#2C7AD6',
        'joola-court-green':  '#2E7D5B',
      },
      fontFamily: {
        display: ['"Archivo Black"', '"Archivo"', 'system-ui', 'sans-serif'],
        sans:    ['"Archivo"', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', '"SF Mono"', 'Menlo', 'monospace'],
      },
      spacing: {
        's-1':  '4px',
        's-2':  '8px',
        's-3':  '12px',
        's-4':  '16px',
        's-5':  '24px',
        's-6':  '32px',
        's-7':  '48px',
        's-8':  '64px',
        's-9':  '96px',
        's-10': '128px',
      },
      borderRadius: {
        'r-0': '0',
        'r-1': '2px',
        'r-2': '4px',
        'r-3': '8px',
        pill:  '999px',
      },
    },
  },
  plugins: [],
};

export default config;
