'use client'

import { useRef, useState } from 'react'
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring, useTransform, type MotionValue } from 'framer-motion'
import { CalendarDays, Sparkles, Wand2, Star, type LucideIcon } from 'lucide-react'
import { PhoneFrame } from './PhoneFrame'
import { BookingScreen } from './screens/BookingScreen'
import { AiSearchScreen } from './screens/AiSearchScreen'
import { TryOnScreen } from './screens/TryOnScreen'
import { RewardsScreen } from './screens/RewardsScreen'

interface Step {
  Icon: LucideIcon
  eyebrow: string
  title: string
  body: string
  Screen: (props: { playing?: boolean }) => JSX.Element
}

const STEPS: Step[] = [
  {
    Icon: CalendarDays,
    eyebrow: 'Book',
    title: 'Three taps to the chair.',
    body: 'Pick a stylist near you on the map, your style, and a time that’s actually free. No calls, no back-and-forth, no queue when you arrive.',
    Screen: BookingScreen,
  },
  {
    Icon: Sparkles,
    eyebrow: 'Cutty AI',
    title: 'Just say what you want.',
    body: '“Braids this weekend under ₦30k near Lekki.” Cutty AI finds the stylists, the prices and the open slots for you.',
    Screen: AiSearchScreen,
  },
  {
    Icon: Wand2,
    eyebrow: 'Virtual try-on',
    title: 'See it on you first.',
    body: 'Snap a selfie and preview knotless braids, locs, a silk press or a fresh fade before you commit to the chair.',
    Screen: TryOnScreen,
  },
  {
    Icon: Star,
    eyebrow: 'Rewards',
    title: 'Loyalty that pays you back.',
    body: 'Earn points on every booking and climb from Bronze to Platinum for better perks the more you visit.',
    Screen: RewardsScreen,
  },
]

const N = STEPS.length

/** Pinned phone whose screen changes as the story scrolls past it. */
export function FeatureScroll() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const p = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.4 })
  const [active, setActive] = useState(0)
  useMotionValueEvent(scrollYProgress, 'change', (v) => setActive(Math.min(N - 1, Math.max(0, Math.floor(v * N)))))

  // The phone sways a little each time the screen changes.
  const rotateY = useTransform(p, [0, 0.25, 0.5, 0.75, 1], [-16, 12, -12, 12, -6])
  const rotateX = useTransform(p, [0, 0.5, 1], [6, -4, 6])
  const y = useTransform(p, [0, 1], [30, -30])

  return (
    <section ref={ref} id="features" className="relative" style={{ height: `${N * 100 + 60}vh` }}>
      <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-6 px-5 md:grid-cols-[1fr_auto] md:gap-16 md:px-8">
          {/* Desktop: the full list, current step lit. */}
          <div className="hidden md:block">
            <p className="mb-6 text-[13px] font-semibold uppercase tracking-[0.2em] text-primary-500">How it works</p>
            <ol className="space-y-8">
              {STEPS.map((s, i) => (
                <li key={s.title} className="relative pl-14">
                  <motion.span
                    animate={{
                      backgroundColor: i === active ? '#D4891A' : '#FFFFFF',
                      color: i === active ? '#FFFFFF' : '#8A8A8A',
                      scale: i === active ? 1 : 0.9,
                    }}
                    transition={{ duration: 0.5 }}
                    className="absolute left-0 top-0.5 flex h-10 w-10 items-center justify-center rounded-2xl shadow-sm"
                  >
                    <s.Icon size={19} />
                  </motion.span>
                  <motion.div animate={{ opacity: i === active ? 1 : 0.3 }} transition={{ duration: 0.5 }}>
                    <p className="text-[13px] font-medium text-primary-500">{s.eyebrow}</p>
                    <h3 className="mt-0.5 text-[clamp(1.6rem,2.8vw,2.4rem)] font-semibold leading-tight tracking-[-0.03em]">{s.title}</h3>
                    <motion.div
                      initial={false}
                      animate={{ height: i === active ? 'auto' : 0, opacity: i === active ? 1 : 0 }}
                      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="max-w-md pt-2 text-[17px] leading-relaxed text-ink-300">{s.body}</p>
                    </motion.div>
                  </motion.div>
                </li>
              ))}
            </ol>
          </div>

          {/* Mobile: just the current step above the phone. */}
          <div className="relative h-[136px] md:hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35 }}
                className="text-center"
              >
                <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-primary-500">{STEPS[active].eyebrow}</p>
                <h3 className="mt-1 text-[28px] font-semibold leading-tight tracking-[-0.03em]">{STEPS[active].title}</h3>
                <p className="mx-auto mt-1.5 max-w-sm text-[15px] leading-snug text-ink-300">{STEPS[active].body}</p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex justify-center" style={{ perspective: 1400 }}>
            <motion.div style={{ rotateY, rotateX, y }} className="preserve-3d relative">
              <div className="phone-scale -my-[56px] sm:my-0">
                <PhoneFrame>
                  {STEPS.map((s, i) => (
                    <ScreenLayer key={s.title} index={i} progress={p}>
                      <s.Screen playing={i === active} />
                    </ScreenLayer>
                  ))}
                </PhoneFrame>
              </div>
              <Dots active={active} />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}

// Each screen slides up over the previous one, which sinks back and dims.
function ScreenLayer({ index, progress, children }: { index: number; progress: MotionValue<number>; children: React.ReactNode }) {
  const start = index / N
  const enter = index === 0 ? [-1, -0.5] : [start - 0.07, start + 0.02]
  const y = useTransform(progress, enter, ['100%', '0%'])
  const radius = useTransform(progress, enter, [36, 0])
  const last = index === N - 1
  const exit = [start + 1 / N - 0.07, start + 1 / N + 0.02]
  const scale = useTransform(progress, exit, [1, last ? 1 : 0.9])
  const filter = useTransform(progress, exit, ['brightness(1)', last ? 'brightness(1)' : 'brightness(0.7)'])
  return (
    <motion.div
      style={{ y, scale, filter, borderTopLeftRadius: radius, borderTopRightRadius: radius, zIndex: index }}
      className="absolute inset-0 overflow-hidden shadow-[0_-20px_40px_-20px_rgba(0,0,0,0.25)]"
    >
      {children}
    </motion.div>
  )
}

function Dots({ active }: { active: number }) {
  return (
    <div className="absolute -bottom-6 left-1/2 flex -translate-x-1/2 gap-1.5 sm:-bottom-10">
      {STEPS.map((s, i) => (
        <motion.span
          key={s.title}
          animate={{ width: i === active ? 22 : 6, backgroundColor: i === active ? '#D4891A' : '#B4B4B4' }}
          className="h-1.5 rounded-full"
        />
      ))}
    </div>
  )
}
