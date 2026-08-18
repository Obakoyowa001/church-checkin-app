import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // ChristTribe design tokens (PRD v2, §4.1) — exact hex, no
        // approximation. navy/blue carry the brand; red is the single
        // accent, used sparingly (primary CTAs, the drain bar, errors).
        navy: {
          900: '#072557',
          800: '#0E2B5E',
        },
        blue: {
          700: '#043280',
          500: '#588EEE',
          300: '#80ACF8',
          100: '#E6EFFE',
        },
        sky: '#F2F7FF',
        red: {
          500: '#ED4020',
        },
        ink: {
          DEFAULT: '#0B1B3D',
          muted: '#5C6B90',
        },
      },
      fontFamily: {
        // Three voices, each used in exactly one role (PRD §4.3):
        // Figtree for body/UI text, Archivo for display headings,
        // Fredoka reserved for the confirmation-screen name only.
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        signature: ['var(--font-signature)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: '12px',
        md: '20px',
        lg: '28px',
      },
      boxShadow: {
        level1: '0 1px 2px rgba(7,37,87,0.05), 0 4px 12px rgba(7,37,87,0.07)',
        level2: '0 8px 32px rgba(7,37,87,0.18)',
      },
      transitionTimingFunction: {
        'brand-out': 'cubic-bezier(0.22,1,0.36,1)',
      },
    },
  },
  plugins: [],
};

export default config;
