'use client'

import { useRef } from 'react'
import { motion, useScroll, useSpring, useTransform, type MotionValue } from 'framer-motion'

const TEXT =
  'Great hair shouldn’t take five phone calls, a two-hour wait and a prayer. Cutty puts the best chairs in your city one tap away — and remembers exactly how you like it.'

/** Apple-style paragraph that "lights up" word by word as you scroll. */
export function TextReveal() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  // Spring-smoothed, which also keeps framer-motion off its native
  // ScrollTimeline path (that path ignores the target offsets above).
  const p = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.4 })
  const words = TEXT.split(' ')

  return (
    <section ref={ref} className="relative h-[220vh]">
      <div className="sticky top-0 flex h-[100svh] items-center justify-center px-5">
        <p className="max-w-5xl text-[clamp(1.9rem,4.6vw,4rem)] font-semibold leading-[1.12] tracking-[-0.035em]">
          {words.map((w, i) => (
            <Word key={i} progress={p} range={[0.1 + (i / words.length) * 0.7, 0.1 + ((i + 1) / words.length) * 0.7]}>
              {w}
            </Word>
          ))}
        </p>
      </div>
    </section>
  )
}

function Word({ children, progress, range }: { children: string; progress: MotionValue<number>; range: [number, number] }) {
  const opacity = useTransform(progress, range, [0.14, 1])
  const highlight = children.startsWith('Cutty') || children.startsWith('tap')
  return (
    <motion.span style={{ opacity }} className={`mr-[0.25em] inline-block ${highlight ? 'text-primary-500' : ''}`}>
      {children}
    </motion.span>
  )
}
