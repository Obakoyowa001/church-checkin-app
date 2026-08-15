import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        teal: {
          DEFAULT: '#0F5D5A',
          deep: '#0A4644',
          light: '#12716D',
        },
        amber: {
          DEFAULT: '#C8862B',
        },
        cream: '#FBF7EF',
        ink: '#1F2A2E',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
