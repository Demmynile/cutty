'use client'

import { useEffect, useRef } from 'react'
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion'
import { ArrowDown } from 'lucide-react'
import { PhoneFrame } from './PhoneFrame'
import { HomeScreen } from './screens/HomeScreen'
import { styleImg } from '@/lib/content'

const EASE = [0.22, 1, 0.36, 1] as const
const HEADLINE = ['Your', 'chair', 'is', 'waiting.']

// Style cards that fan out from behind the phone as you scroll, each at its
// own depth so nearer cards drift faster (parallax).
const CARDS = [
  { slug: 'knotless-braids', x: -400, y: -150, rot: -10, w: 170, depth: 1.25, wide: true },
  { slug: 'skin-fade', x: -310, y: 150, rot: 7, w: 150, depth: 0.8 },
  { slug: 'silk-press', x: -560, y: 40, rot: -4, w: 130, depth: 0.55, wide: true },
  { slug: 'locs-women', x: 400, y: -160, rot: 9, w: 165, depth: 1.15, wide: true },
  { slug: 'waves', x: 320, y: 140, rot: -6, w: 150, depth: 0.85 },
  { slug: 'senegalese-twists', x: 570, y: 20, rot: 5, w: 130, depth: 0.6, wide: true },
]

export function Hero() {
  const ref = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const sp = useSpring(p, { stiffness: 120, damping: 30, mass: 0.4 })

  // Headline lifts away while the phone tilts up from the "table" into view.
  const titleOpacity = useTransform(sp, [0, 0.22], [1, 0])
  const titleY = useTransform(sp, [0, 0.25], [0, -120])
  const titleScale = useTransform(sp, [0, 0.25], [1, 0.92])
  const phoneRotX = useTransform(sp, [0, 0.45], [48, 0])
  // How far below centre the phone starts. Desktop gets a bigger drop so the
  // phone clears the CTA buttons under the one-line headline.
  const drop = useMotionValue(42)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const update = () => drop.set(mq.matches ? 56 : 42)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [drop])
  const phoneY = useTransform([sp, drop], ([v, d]: number[]) => `${d * (1 - Math.min(v / 0.45, 1))}vh`)
  const phoneScale = useTransform(sp, [0, 0.45, 1], [0.78, 1, 1])
  const glow = useTransform(sp, [0, 0.45], [0.3, 1])

  // Pointer tilt, layered on top of the scroll tilt.
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const tiltY = useSpring(useTransform(mx, [-1, 1], [-14, 14]), { stiffness: 80, damping: 18 })
  const tiltX = useSpring(useTransform(my, [-1, 1], [10, -10]), { stiffness: 80, damping: 18 })

  return (
    <section
      ref={ref}
      id="top"
      className="relative h-[260vh]"
      onPointerMove={(e) => {
        if (reduce || e.pointerType !== 'mouse') return
        mx.set((e.clientX / window.innerWidth) * 2 - 1)
        my.set((e.clientY / window.innerHeight) * 2 - 1)
      }}
    >
      <div className="sticky top-0 flex h-[100svh] flex-col items-center overflow-hidden">
        {/* soft warm light behind everything */}
        <motion.div
          style={{ opacity: glow }}
          className="pointer-events-none absolute left-1/2 top-[55%] h-[70vmin] w-[90vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(241,169,31,0.35),rgba(241,169,31,0.08)_60%,transparent)] blur-2xl"
        />

        <motion.div
          style={{ opacity: titleOpacity, y: titleY, scale: titleScale }}
          className="relative z-10 mt-[15vh] px-4 text-center sm:mt-[16vh]"
        >
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
            className="mb-4 text-[13px] font-semibold uppercase tracking-[0.2em] text-primary-500"
          >
            Coming soon to iOS & Android
          </motion.p>
          <h1 className="text-[clamp(2.9rem,9vw,7.5rem)] font-semibold leading-[0.95] tracking-tightest">
            {HEADLINE.map((w, i) => (
              <motion.span
                key={w}
                initial={{ opacity: 0, y: 40, filter: 'blur(12px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 1.1, ease: EASE, delay: 0.25 + i * 0.09 }}
                className={`mr-[0.22em] inline-block last:mr-0 ${i === 3 ? 'text-gradient -mb-[0.2em] pb-[0.2em]' : ''}`}
              >
                {w}
              </motion.span>
            ))}
          </h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: EASE, delay: 0.7 }}
            className="mx-auto mt-5 max-w-xl text-[clamp(1.05rem,2vw,1.35rem)] leading-snug text-ink-300"
          >
            Book the best barbers and stylists in seconds. Try new looks with AI. Earn rewards on every visit.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: EASE, delay: 0.85 }}
            className="mt-7 flex items-center justify-center gap-4"
          >
            <a
              href="#waitlist"
              className="rounded-full bg-primary-500 px-6 py-3 text-[15px] font-medium text-white shadow-[0_12px_30px_-10px_rgba(212,137,26,0.8)] transition-transform hover:scale-[1.04] active:scale-[0.98]"
            >
              Join the waitlist
            </a>
            <a href="#features" className="group flex items-center gap-1.5 text-[15px] font-medium text-primary-600">
              See how it works
              <ArrowDown size={15} className="transition-transform group-hover:translate-y-0.5" />
            </a>
          </motion.div>
        </motion.div>

        {/* 3D stage */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ perspective: 1600 }}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.4, ease: EASE, delay: 0.5 }}
            style={{ rotateX: phoneRotX, y: phoneY, scale: phoneScale, transformOrigin: '50% 0%' }}
            className="preserve-3d relative"
          >
            {CARDS.map((c) => (
              <FloatingCard key={c.slug} card={c} progress={sp} />
            ))}
            <motion.div style={{ rotateX: tiltX, rotateY: tiltY }} className="preserve-3d relative z-10">
              <div className="phone-scale">
                <PhoneFrame>
                  <HomeScreen />
                </PhoneFrame>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

function FloatingCard({ card, progress }: { card: (typeof CARDS)[number]; progress: MotionValue<number> }) {
  const x = useTransform(progress, [0, 0.5], [card.x * 0.25, card.x])
  const y = useTransform(progress, [0, 0.5, 1], [card.y + 220, card.y + 260, card.y + 260 - 240 * card.depth])
  const rotate = useTransform(progress, [0, 0.5], [0, card.rot])
  const opacity = useTransform(progress, [0.05, 0.3], [0, 1])
  const z = useTransform(progress, [0, 0.5], [-200, (card.depth - 1) * 300])

  return (
    <motion.div
      style={{ x, y, rotate, opacity, z, width: card.w, left: 150 - card.w / 2 }}
      className={`absolute top-0 ${card.wide ? 'hidden lg:block' : 'hidden sm:block'}`}
    >
      <div className="overflow-hidden rounded-[22px] bg-white p-1.5 shadow-[0_30px_60px_-25px_rgba(17,17,17,0.45)]">
        <img src={styleImg(card.slug)} alt="" className="aspect-[4/5] w-full rounded-[17px] object-cover" />
      </div>
    </motion.div>
  )
}
