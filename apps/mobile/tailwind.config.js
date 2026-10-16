/** @type {import('tailwindcss').Config} */
const themed = (name) => `rgb(var(--color-${name}) / <alpha-value>)`

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
          400: themed('primary-400'),
          500: '#d4891a',
          600: '#b86915',
          700: '#9b490f',
          800: '#7e290a',
          900: '#620905',
        },
        // Theme-aware foreground: white in dark mode, near-black in light mode.
        // Use plain `white` for text that sits on primary buttons or photos.
        fg: themed('fg'),
        dark: {
          50: themed('dark-50'),
          100: themed('dark-100'),
          200: themed('dark-200'),
          300: themed('dark-300'),
          400: themed('dark-400'),
          500: themed('dark-500'),
          600: themed('dark-600'),
          700: themed('dark-700'),
          800: themed('dark-800'),
          900: themed('dark-900'),
        },
      },
      fontFamily: {
        sans: ['Inter', 'System'],
      },
    },
  },
  plugins: [],
}
