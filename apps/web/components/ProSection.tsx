'use client'

import { useRef } from 'react'
import { motion, useScroll, useSpring, useTransform } from 'framer-motion'
import { CalendarCheck, Banknote, Bot, Users } from 'lucide-react'
import { PhoneFrame } from './PhoneFrame'
import { ProDashboardScreen, ProChatScreen } from './screens/ProScreens'
import { Reveal } from './Reveal'

const POINTS = [
  { Icon: CalendarCheck, title: 'A full chair', body: 'Get discovered by clients searching for exactly what you do.' },
  { Icon: Banknote, title: 'Paid, properly', body: 'Clients pay in the app through Paystack. No chasing transfers.' },
  { Icon: Bot, title: 'An assistant that never sleeps', body: 'Away assistant answers questions and books slots while you work.' },
  { Icon: Users, title: 'Clients who come back', body: 'Notes, history and rewards that keep regulars regular.' },
]

export function ProSection() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const p = useSpring(scrollYProgress, { stiffness: 100, damping: 30, mass: 0.5 })

  // Two phones start stacked and fan apart in 3D as the section passes.
  const leftX = useTransform(p, [0.1, 0.5], [-20, -125])
  const leftRotY = useTransform(p, [0.1, 0.5], [0, 22])
  const leftRotZ = useTransform(p, [0.1, 0.5], [0, -6])
  const rightX = useTransform(p, [0.1, 0.5], [20, 125])
  const rightRotY = useTransform(p, [0.1, 0.5], [0, -22])
  const rightRotZ = useTransform(p, [0.1, 0.5], [0, 6])
  const rightY = useTransform(p, [0, 1], [120, -80])
  const leftY = useTransform(p, [0, 1], [40, -20])

  return (
    <section ref={ref} id="pro" className="relative overflow-hidden bg-white py-28 md:py-40">
      <div className="mx-auto grid max-w-6xl items-center gap-16 px-5 md:grid-cols-2 md:px-8">
        <div>
          <Reveal>
            <p className="text-[13px] font-semibold uppercase tracking-[0.2em] text-primary-500">Cutty Pro</p>
            <h2 className="mt-2 text-[clamp(2.2rem,5vw,4.2rem)] font-semibold leading-[1] tracking-tightest">
              For the hands <br className="hidden sm:block" />
              behind the chair.
            </h2>
            <p className="mt-5 max-w-md text-[18px] leading-relaxed text-ink-300">
              Barbers and stylists get a business in their pocket: bookings, payments, chat and a clear view of the week.
            </p>
          </Reveal>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {POINTS.map(({ Icon, title, body }, i) => (
              <Reveal key={title} delay={0.06 * i}>
                <Icon className="text-primary-500" size={22} />
                <p className="mt-2.5 text-[16px] font-semibold">{title}</p>
                <p className="mt-1 text-[14px] leading-relaxed text-ink-400">{body}</p>
              </Reveal>
            ))}
          </div>
        </div>

        <div className="relative flex h-[560px] items-center justify-center sm:h-[680px]" style={{ perspective: 1600 }}>
          <div className="pointer-events-none absolute inset-0 m-auto h-[70%] w-[80%] rounded-full bg-[radial-gradient(closest-side,rgba(241,169,31,0.25),transparent)] blur-2xl" />
          <motion.div style={{ x: leftX, y: leftY, rotateY: leftRotY, rotateZ: leftRotZ }} className="absolute">
            <div className="phone-scale">
              <PhoneFrame>
                <ProDashboardScreen />
              </PhoneFrame>
            </div>
          </motion.div>
          <motion.div style={{ x: rightX, y: rightY, rotateY: rightRotY, rotateZ: rightRotZ }} className="absolute">
            <div className="phone-scale">
              <PhoneFrame>
                <ProChatScreen />
              </PhoneFrame>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
