import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fdf4e7', 100: '#fae3b0', 200: '#f7d080',
          300: '#f4bc4f', 400: '#f1a91f', 500: '#d4891a',
          600: '#b86915', 700: '#9b490f', 800: '#7e290a', 900: '#620905',
        },
      },
    },
  },
  plugins: [],
}
export default config
