/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fdf4e7',
          100: '#fae3b0',
          200: '#f7d080',
          300: '#f4bc4f',
          400: '#f1a91f',
          500: '#d4891a',
          600: '#b86915',
          700: '#9b490f',
          800: '#7e290a',
          900: '#620905',
        },
        dark: {
          50: '#f8f8f8',
          100: '#e8e8e8',
          200: '#c8c8c8',
          300: '#a8a8a8',
          400: '#888888',
          500: '#686868',
          600: '#484848',
          700: '#282828',
          800: '#1a1a1a',
          900: '#111111',
        },
      },
      fontFamily: {
        sans: ['Inter', 'System'],
      },
    },
  },
  plugins: [],
}
