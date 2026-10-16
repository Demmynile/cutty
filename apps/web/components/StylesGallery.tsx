'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useScroll, useSpring, useTransform } from 'framer-motion'
import { Wand2 } from 'lucide-react'
import { STYLES, styleImg } from '@/lib/content'

/** Vertical scroll drives a horizontal track of styles. */
export function StylesGallery() {
  const ref = useRef<HTMLElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const [distance, setDistance] = useState(0)

  useEffect(() => {
    const measure = () => setDistance(Math.max(0, (track.current?.scrollWidth ?? 0) - window.innerWidth))
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const p = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 })
  const x = useTransform(p, [0.05, 0.95], [0, -distance])
  const imgX = useTransform(p, [0, 1], ['-8%', '8%'])
  const rotateY = useTransform(p, [0, 0.5, 1], [-10, 0, 10])

  return (
    <section ref={ref} id="styles" className="relative h-[340vh]">
      <div className="sticky top-0 flex h-[100svh] flex-col justify-center overflow-hidden">
        <div className="mx-auto mb-10 w-full max-w-6xl px-5 md:px-8">
          <p className="text-[13px] font-semibold uppercase tracking-[0.2em] text-primary-500">Every texture. Every style.</p>
          <h2 className="mt-2 max-w-3xl text-[clamp(2.2rem,5.5vw,4.5rem)] font-semibold leading-[1] tracking-tightest">
            Fades to knotless. <span className="text-ink-500">Locs to lace fronts.</span>
          </h2>
        </div>
        <div style={{ perspective: 1800 }}>
          <motion.div ref={track} style={{ x, rotateY }} className="preserve-3d flex w-max gap-5 pl-5 pr-[10vw] md:pl-[max(2rem,calc((100vw-72rem)/2+2rem))]">
            {STYLES.map((s, i) => (
              <motion.figure
                key={s.slug}
                whileHover={{ y: -10, scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                className={`group relative shrink-0 overflow-hidden rounded-[28px] bg-white shadow-[0_30px_60px_-30px_rgba(17,17,17,0.35)] ${
                  i % 3 === 1 ? 'mt-10 h-[min(52vh,440px)] w-[min(70vw,330px)]' : 'h-[min(58vh,480px)] w-[min(70vw,360px)]'
                }`}
              >
                <motion.img src={styleImg(s.slug)} alt={s.label} style={{ x: imgX, scale: 1.2 }} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/0 to-black/0" />
                <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5 text-white">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/70">{s.category}</p>
                    <p className="text-[22px] font-semibold tracking-tight">{s.label}</p>
                  </div>
                  <span className="flex translate-y-2 items-center gap-1 rounded-full bg-white/20 px-3 py-1.5 text-[12px] font-medium opacity-0 backdrop-blur-md transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                    <Wand2 size={12} /> Try it on
                  </span>
                </figcaption>
              </motion.figure>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
