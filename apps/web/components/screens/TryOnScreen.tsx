'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, Share2, Wand2 } from 'lucide-react'
import { styleImg } from '@/lib/content'

const OPTIONS = [
  { slug: 'knotless-braids', label: 'Knotless braids' },
  { slug: 'locs-women', label: 'Locs' },
  { slug: 'silk-press', label: 'Silk press' },
  { slug: 'bantu-knots', label: 'Bantu knots' },
]

/** Cycles through styles on its own, like the try-on rendering previews. */
export function TryOnScreen({ playing = true }: { playing?: boolean }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (!playing) return
    const t = setInterval(() => setI((n) => (n + 1) % OPTIONS.length), 2400)
    return () => clearInterval(t)
  }, [playing])
  const active = OPTIONS[i]

  return (
    <div className="absolute inset-0 overflow-hidden bg-page text-fg">
      <div className="flex items-center gap-2 bg-white px-4 pb-3 pt-[52px]">
        <ChevronLeft size={20} />
        <div>
          <p className="text-[15px] font-bold leading-tight">Virtual Try-On</p>
          <p className="text-[9.5px] text-ink-400">See AI previews of styles on your photo</p>
        </div>
      </div>

      <div className="px-3.5 pt-3">
        <div className="relative h-[300px] overflow-hidden rounded-3xl bg-ink-700">
          <AnimatePresence initial={false}>
            <motion.img
              key={active.slug}
              src={styleImg(active.slug)}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              initial={{ opacity: 0, scale: 1.08, filter: 'blur(8px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            />
          </AnimatePresence>
          <div className="animate-scan absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-transparent via-white/40 to-transparent" />
          <div className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-[9.5px] font-medium text-white backdrop-blur">
            <Wand2 size={10} /> AI preview
          </div>
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 rounded-full bg-black/45 px-2.5 py-1 text-[9.5px] font-medium text-white backdrop-blur">
            Hold to compare
          </div>
        </div>

        <div className="mt-3 flex gap-1.5 overflow-hidden">
          {OPTIONS.map((o, n) => (
            <span
              key={o.slug}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[10.5px] font-medium transition-colors duration-500 ${
                n === i ? 'bg-primary-500 text-white' : 'bg-white text-ink-200'
              }`}
            >
              {o.label}
            </span>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <div className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white py-2.5 text-[11.5px] font-semibold">
            <Share2 size={13} /> Share
          </div>
          <div className="flex-[1.6] rounded-xl bg-primary-500 py-2.5 text-center text-[11.5px] font-semibold text-white">
            Book {active.label.toLowerCase()}
          </div>
        </div>
      </div>
    </div>
  )
}
