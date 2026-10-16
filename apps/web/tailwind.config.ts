import type { Config } from 'tailwindcss'

// The mobile app's light palette (apps/mobile/lib/theme.ts), so the site and
// the phone mockups on it read as the same product.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fdf4e7', 100: '#fae3b0', 200: '#f7d080',
          300: '#f4bc4f', 400: '#B86915', 500: '#d4891a',
          600: '#b86915', 700: '#9b490f', 800: '#7e290a', 900: '#620905',
        },
        fg: '#111111',
        ink: {
          100: '#1F1F1F', 200: '#333333', 300: '#4A4A4A', 400: '#6B6B6B',
          500: '#8A8A8A', 600: '#B4B4B4', 700: '#E4E4E7',
        },
        card: '#FFFFFF',
        page: '#F4F4F5',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        tightest: '-0.045em',
      },
    },
  },
  plugins: [],
}
export default config
