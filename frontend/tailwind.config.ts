import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Sport accent colours — used for left border and badge on event cards
        f1: '#15803d',
        ajax: '#cc0000',
        az: '#b71c1c',
        'mvdp-road': '#0077cc',
        'mvdp-cx': '#2d7d2d',
        'mvdp-mtb': '#8b6914',
        'pp-road': '#c2185b',
        'pp-cx': '#880e4f',
      },
    },
  },
  plugins: [],
};

export default config;
