'use client'

import { useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Check, Loader2 } from 'lucide-react'
import { API_URL, styleImg } from '@/lib/content'

type Role = 'customer' | 'stylist'
type State = { status: 'idle' | 'loading' } | { status: 'done'; count: number | null } | { status: 'error'; message: string }

const ORBIT = ['knotless-braids', 'skin-fade', 'locs-women', 'waves', 'silk-press', 'bantu-knots', 'taper-fade', 'afro-women']

export function Waitlist() {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('customer')
  const [state, setState] = useState<State>({ status: 'idle' })

  async function submit(e: FormEvent) {
    e.preventDefault()
    setState({ status: 'loading' })
    try {
      const res = await fetch(`${API_URL}/api/v1/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.')
      setState({ status: 'done', count: typeof data.count === 'number' ? data.count : null })
    } catch (err) {
      const message = err instanceof TypeError ? 'Couldn’t reach Cutty. Check your connection and try again.' : (err as Error).message
      setState({ status: 'error', message })
    }
  }

  return (
    <section id="waitlist" className="relative overflow-hidden px-5 py-28 md:py-40">
      {/* slow orbit of styles behind the card */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ perspective: 1400 }}>
        <motion.div
          animate={{ rotateY: 360 }}
          transition={{ duration: 60, ease: 'linear', repeat: Infinity }}
          className="preserve-3d relative h-0 w-0"
          style={{ rotateX: -8 }}
        >
          {ORBIT.map((slug, i) => (
            <div
              key={slug}
              className="absolute -left-[70px] -top-[88px] h-[176px] w-[140px] overflow-hidden rounded-3xl opacity-80 shadow-xl"
              style={{ transform: `rotateY(${(360 / ORBIT.length) * i}deg) translateZ(min(520px, 46vw))` }}
            >
              <img src={styleImg(slug)} alt="" className="h-full w-full object-cover" />
            </div>
          ))}
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 60, scale: 0.96 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto max-w-xl rounded-[36px] border border-white/60 bg-white/75 p-8 text-center shadow-[0_40px_100px_-40px_rgba(17,17,17,0.4)] backdrop-blur-2xl backdrop-saturate-150 sm:p-12"
      >
        <AnimatePresence mode="wait" initial={false}>
          {state.status === 'done' ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="py-6"
            >
              <motion.div
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.1 }}
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-500 text-white shadow-[0_15px_30px_-10px_rgba(212,137,26,0.9)]"
              >
                <Check size={30} strokeWidth={3} />
              </motion.div>
              <h3 className="mt-6 text-[32px] font-semibold tracking-tight">You’re on the list.</h3>
              <p className="mt-2 text-[16px] text-ink-400">
                {state.count && state.count > 1
                  ? `You and ${(state.count - 1).toLocaleString()} others will be first in the chair.`
                  : 'We’ll email you the moment Cutty opens in your city.'}
              </p>
            </motion.div>
          ) : (
            <motion.div key="form" exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.3 }}>
              <p className="text-[13px] font-semibold uppercase tracking-[0.2em] text-primary-500">Early access</p>
              <h2 className="mt-3 text-[clamp(2.2rem,6vw,3.6rem)] font-semibold leading-[1] tracking-tightest">
                Be first <br />
                in the chair.
              </h2>
              <p className="mx-auto mt-4 max-w-sm text-[16px] leading-relaxed text-ink-400">
                Join the waitlist for early access, launch perks and a welcome reward when we open.
              </p>

              <form onSubmit={submit} className="mt-8 space-y-3 text-left">
                <div role="radiogroup" aria-label="I'm joining as" className="relative grid grid-cols-2 rounded-full bg-page p-1 text-[14px] font-medium">
                  <motion.span
                    layout
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    className={`absolute inset-y-1 w-[calc(50%-4px)] rounded-full bg-white shadow-sm ${role === 'customer' ? 'left-1' : 'left-[calc(50%+0px)]'}`}
                  />
                  {(
                    [
                      ['customer', 'I want to book'],
                      ['stylist', 'I’m a stylist'],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={role === value}
                      onClick={() => setRole(value)}
                      className={`relative z-10 rounded-full py-2.5 transition-colors ${role === value ? 'text-fg' : 'text-ink-400'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-col gap-2 rounded-[22px] bg-white p-1.5 shadow-[inset_0_0_0_1px_#E4E4E7] focus-within:shadow-[inset_0_0_0_2px_#D4891A] sm:flex-row sm:rounded-full">
                  <label htmlFor="email" className="sr-only">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent px-4 py-3 text-[16px] outline-none placeholder:text-ink-500"
                  />
                  <button
                    type="submit"
                    disabled={state.status === 'loading'}
                    className="group flex items-center justify-center gap-2 rounded-full bg-fg px-6 py-3 text-[15px] font-medium text-white transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70"
                  >
                    {state.status === 'loading' ? (
                      <Loader2 size={17} className="animate-spin" />
                    ) : (
                      <>
                        Join waitlist <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                      </>
                    )}
                  </button>
                </div>
                <AnimatePresence>
                  {state.status === 'error' && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      role="alert"
                      className="px-4 text-[14px] text-red-600"
                    >
                      {state.message}
                    </motion.p>
                  )}
                </AnimatePresence>
                <p className="px-4 text-center text-[12px] text-ink-500">No spam. Just one email when we launch near you.</p>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </section>
  )
}
