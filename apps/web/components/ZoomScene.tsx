'use client'

import { useRef } from 'react'
import { motion, useScroll, useSpring, useTransform } from 'framer-motion'

/** A framed photo that opens up to fill the screen as you scroll into it. */
export function ZoomScene() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  // Spring-smoothed, which also keeps framer-motion off its native
  // ScrollTimeline path (that path ignores the target offsets above).
  const p = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.4 })

  const clipPath = useTransform(p, (v) => {
    const t = Math.min(1, v / 0.55)
    const e = 1 - Math.pow(1 - t, 3)
    const iy = 14 * (1 - e)
    const ix = 26 * (1 - e)
    const r = 44 * (1 - e)
    return `inset(${iy}% ${ix}% ${iy}% ${ix}% round ${r}px)`
  })
  const imgScale = useTransform(p, [0, 0.6, 1], [1.35, 1.05, 1])
  const shade = useTransform(p, [0.35, 0.65], [0, 0.55])
  const textOpacity = useTransform(p, [0.5, 0.68], [0, 1])
  const textY = useTransform(p, [0.5, 0.75], [60, 0])
  const subOpacity = useTransform(p, [0.62, 0.8], [0, 1])

  return (
    <section ref={ref} className="relative h-[260vh]">
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <motion.div style={{ clipPath }} className="absolute inset-0 will-change-[clip-path]">
          <motion.img
            src="/images/scenes/03-full.jpg"
            alt="Two friends laughing in a warm, sunlit barbershop"
            style={{ scale: imgScale }}
            className="h-full w-full object-cover"
          />
          <motion.div style={{ opacity: shade }} className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/10" />
        </motion.div>
        <div className="absolute inset-x-0 bottom-[12vh] px-6 text-center text-white">
          <motion.h2
            style={{ opacity: textOpacity, y: textY }}
            className="text-[clamp(2.6rem,8vw,6.5rem)] font-semibold leading-[0.95] tracking-tightest"
          >
            More than a haircut.
          </motion.h2>
          <motion.p style={{ opacity: subOpacity }} className="mx-auto mt-5 max-w-xl text-[clamp(1.05rem,2vw,1.35rem)] text-white/80">
            It’s the hour you get back. The stylist who remembers. The look that walks out the door with you.
          </motion.p>
        </div>
      </div>
    </section>
  )
}
