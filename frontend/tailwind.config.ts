import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Sport accent colours — used for left border and badge on event cards
        f1: '#e10600',
        ajax: '#cc0000',
        'mvdp-road': '#0077cc',
        'mvdp-cx': '#2d7d2d',
        'mvdp-mtb': '#8b6914',
      },
    },
  },
  plugins: [],
};

export default config;
