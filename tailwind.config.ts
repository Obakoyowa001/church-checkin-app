import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Brand blue, anchored on the real ChristTribe brand materials
        // (badge, verse cards, QR flyer) rather than the muted teal in
        // the standalone logo file.
        brand: {
          DEFAULT: '#3D66D6',
          deep: '#122761',
          deeper: '#09132E',
          mid: '#1E3B8D',
          tint: '#EDF0F7',
        },
        accent: {
          DEFAULT: '#E8582C', // warm red-orange, used sparingly
          gold: '#EFB239',
        },
        cream: '#FBF8F3',
        ink: '#1B2A2E',
      },
      fontFamily: {
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
