import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from '@/components/Providers'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3004'),
  title: 'Cutty — Your chair is waiting',
  description:
    'Book top barbers and stylists in seconds, try styles on with AI, and earn rewards every visit. Join the Cutty waitlist.',
  openGraph: {
    title: 'Cutty — Your chair is waiting',
    description: 'Book top barbers and stylists in seconds. Join the waitlist.',
    images: ['/images/scenes/01.jpg'],
  },
}

export const viewport: Viewport = {
  themeColor: '#F4F4F5',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
