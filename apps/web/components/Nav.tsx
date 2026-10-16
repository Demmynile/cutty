'use client'

import { useState } from 'react'
import { motion, useMotionValueEvent, useScroll } from 'framer-motion'
import { Scissors } from 'lucide-react'

const LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#styles', label: 'Styles' },
  { href: '#pro', label: 'For stylists' },
]

export function Nav() {
  const { scrollY } = useScroll()
  const [scrolled, setScrolled] = useState(false)
  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 24))

  return (
    <motion.header
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
      className={`fixed inset-x-0 top-0 z-50 transition-[background,border-color,backdrop-filter] duration-500 ${
        scrolled ? 'border-b border-black/[0.06] bg-white/70 backdrop-blur-xl backdrop-saturate-150' : 'border-b border-transparent'
      }`}
    >
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <a href="#top" className="flex items-center gap-2 text-[17px] font-semibold tracking-tight">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-fg text-[#F1A91F]">
            <Scissors size={15} strokeWidth={2.4} />
          </span>
          Cutty
        </a>
        <div className="hidden items-center gap-8 text-[13px] text-ink-300 md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="transition-colors hover:text-fg">
              {l.label}
            </a>
          ))}
        </div>
        <a
          href="#waitlist"
          className="rounded-full bg-fg px-4 py-1.5 text-[13px] font-medium text-white transition-transform hover:scale-[1.03] active:scale-[0.98]"
        >
          Join waitlist
        </a>
      </nav>
    </motion.header>
  )
}
