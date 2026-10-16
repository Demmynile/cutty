// Copy and imagery shared by the sections and the phone mockups.

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002').replace(/\/$/, '')

export const STYLES = [
  { slug: 'knotless-braids', label: 'Knotless braids', category: 'Braids' },
  { slug: 'skin-fade', label: 'Skin fade', category: 'Barbering' },
  { slug: 'locs-women', label: 'Locs', category: 'Locs' },
  { slug: 'silk-press', label: 'Silk press', category: 'Styling' },
  { slug: 'waves', label: '360 waves', category: 'Barbering' },
  { slug: 'senegalese-twists', label: 'Senegalese twists', category: 'Twists' },
  { slug: 'taper-fade', label: 'Taper fade', category: 'Barbering' },
  { slug: 'lace-front-wig', label: 'Lace front wig', category: 'Wigs' },
  { slug: 'afro-women', label: 'Natural afro', category: 'Natural' },
  { slug: 'cornrows-men', label: 'Cornrows', category: 'Braids' },
  { slug: 'bantu-knots', label: 'Bantu knots', category: 'Natural' },
  { slug: 'curly-top-men', label: 'Curly top', category: 'Barbering' },
  { slug: 'pixie', label: 'Pixie cut', category: 'Styling' },
  { slug: 'box-braids', label: 'Box braids', category: 'Braids' },
] as const

export const styleImg = (slug: string) => `/images/styles/${slug}.jpg`

export const naira = (n: number) => `₦${n.toLocaleString('en-NG')}`
