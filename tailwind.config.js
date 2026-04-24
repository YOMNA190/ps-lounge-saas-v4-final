/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ps: {
          blue:         '#0057ff',
          'blue-light': '#3d8bff',
          darker:       '#04040a',
          surface:      '#0d0d1a',
          card:         '#111120',
          'card-hover': '#15152a',
          border:       '#1a1a30',
          'border-hi':  '#24244a',
          text:         '#e2e2f2',
          muted:        '#52527a',
          green:        '#00e5a0',
          red:          '#ff3d5a',
          gold:         '#ffc843',
          purple:       '#9b6dff',
          cyan:         '#00c8e0',
        },
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'cursive'],
        body:    ['"IBM Plex Sans Arabic"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
