'use client'

import { Wallet, MessageCircle, BellRing, ShieldCheck, MapPin, Clock } from 'lucide-react'
import { Reveal } from './Reveal'
import { TiltCard } from './TiltCard'
import { styleImg } from '@/lib/content'

export function Bento() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-28 md:px-8 md:py-40">
      <Reveal>
        <p className="text-[13px] font-semibold uppercase tracking-[0.2em] text-primary-500">The details</p>
        <h2 className="mt-2 max-w-3xl text-[clamp(2.2rem,5.5vw,4.5rem)] font-semibold leading-[1] tracking-tightest">
          Thoughtful, down to the last line-up.
        </h2>
      </Reveal>

      <div className="mt-14 grid auto-rows-[minmax(220px,auto)] grid-cols-1 gap-4 md:grid-cols-6">
        <Reveal className="md:col-span-4">
          <TiltCard className="h-full" max={6}>
            <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-[32px] bg-white p-7 md:flex-row md:items-end">
              <div className="max-w-xs">
                <Wallet className="text-primary-500" />
                <h3 className="mt-4 text-[26px] font-semibold leading-tight tracking-tight">A wallet built for naira.</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-400">
                  Top up once, tap to pay at the chair. Secured by Paystack, with every kobo accounted for.
                </p>
              </div>
              <div className="preserve-3d mt-6 md:mt-0" style={{ transform: 'translateZ(40px)' }}>
                <div className="w-[260px] rounded-3xl bg-gradient-to-br from-[#1f1f1f] to-[#111] p-5 text-white shadow-[0_30px_50px_-20px_rgba(17,17,17,0.6)]">
                  <p className="text-[11px] text-white/60">Wallet balance</p>
                  <p className="mt-1 text-[30px] font-bold tracking-tight">₦45,500</p>
                  <div className="mt-4 flex gap-2 text-[12px]">
                    <span className="rounded-full bg-[#F1A91F] px-3 py-1 font-semibold text-black">Top up</span>
                    <span className="rounded-full bg-white/10 px-3 py-1">History</span>
                  </div>
                </div>
              </div>
            </div>
          </TiltCard>
        </Reveal>

        <Reveal className="md:col-span-2" delay={0.08}>
          <TiltCard className="h-full">
            <div className="flex h-full flex-col overflow-hidden rounded-[32px] bg-fg p-7 text-white">
              <MessageCircle className="text-[#F1A91F]" />
              <h3 className="mt-4 text-[24px] font-semibold leading-tight tracking-tight">Chat with your stylist.</h3>
              <p className="mt-2 text-[15px] text-white/60">Send inspo photos before you arrive. They’ll know the plan.</p>
              <div className="mt-auto space-y-1.5 pt-6 text-[12px]">
                <div className="w-fit rounded-2xl rounded-bl-md bg-white/10 px-3 py-1.5">Can we go a bit shorter on the sides?</div>
                <div className="ml-auto w-fit rounded-2xl rounded-br-md bg-[#D4891A] px-3 py-1.5">Say less 💈</div>
              </div>
            </div>
          </TiltCard>
        </Reveal>

        <Reveal className="md:col-span-2" delay={0.04}>
          <TiltCard className="h-full">
            <div className="relative h-full min-h-[260px] overflow-hidden rounded-[32px]">
              <img src="/images/scenes/02.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-black/0" />
              <div className="absolute bottom-0 p-7 text-white">
                <ShieldCheck className="text-[#F1A91F]" />
                <h3 className="mt-3 text-[22px] font-semibold leading-tight tracking-tight">Verified stylists, real reviews.</h3>
              </div>
            </div>
          </TiltCard>
        </Reveal>

        <Reveal className="md:col-span-2" delay={0.1}>
          <TiltCard className="h-full">
            <div className="flex h-full flex-col rounded-[32px] bg-white p-7">
              <BellRing className="text-primary-500" />
              <h3 className="mt-4 text-[22px] font-semibold leading-tight tracking-tight">Never miss a slot.</h3>
              <p className="mt-2 text-[15px] text-ink-400">Reminders before every appointment, and a nudge when you’re due a touch-up.</p>
              <div className="mt-auto flex items-center gap-3 rounded-2xl bg-page p-3 pt-3">
                <img src={styleImg('taper-fade')} alt="" className="h-9 w-9 rounded-xl object-cover" />
                <div className="text-[12px]">
                  <p className="font-semibold">Tomorrow, 11:30</p>
                  <p className="text-ink-400">Taper fade with Dayo</p>
                </div>
              </div>
            </div>
          </TiltCard>
        </Reveal>

        <Reveal className="md:col-span-2" delay={0.16}>
          <TiltCard className="h-full">
            <div className="flex h-full flex-col justify-between rounded-[32px] bg-gradient-to-br from-primary-100 via-primary-200 to-primary-300 p-7">
              <div className="flex gap-3 text-primary-700">
                <MapPin />
                <Clock />
              </div>
              <div>
                <p className="text-[46px] font-semibold leading-none tracking-tightest text-primary-800">Open now.</p>
                <p className="mt-2 text-[15px] font-medium text-primary-800/80">See stylists near you with a free chair today, not next week.</p>
              </div>
            </div>
          </TiltCard>
        </Reveal>
      </div>
    </section>
  )
}
