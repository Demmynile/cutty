import { ChevronLeft, Check } from 'lucide-react'
import { styleImg } from '@/lib/content'

const DAYS = [
  { d: 'Thu', n: 16 }, { d: 'Fri', n: 17 }, { d: 'Sat', n: 18 }, { d: 'Sun', n: 19 }, { d: 'Mon', n: 20 },
]
const SLOTS = ['09:00', '10:00', '11:30', '13:00', '14:30', '16:00', '17:30', '19:00']
const TAKEN = new Set(['10:00', '14:30'])

export function BookingScreen() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-page text-fg">
      <div className="flex items-center gap-2 bg-white px-4 pb-3 pt-[52px]">
        <ChevronLeft size={20} />
        <p className="text-[16px] font-bold">Book appointment</p>
      </div>

      <div className="px-4 pt-3">
        <p className="text-[10px] font-medium tracking-wide text-ink-400">STYLIST · FROM THE MAP</p>
        <div className="mt-1.5 flex items-center gap-2.5 rounded-2xl bg-white p-2.5">
          <img src={styleImg('locs-women')} alt="" className="h-9 w-9 rounded-full object-cover" />
          <div className="flex-1">
            <p className="text-[12px] font-semibold">Amaka Obi</p>
            <p className="text-[10px] text-ink-400">★ 5.0 · Lekki Phase 1 · 1.2 km</p>
          </div>
          <span className="text-[10px] font-medium text-primary-400">Change</span>
        </div>

        <p className="mt-4 text-[10px] font-medium tracking-wide text-ink-400">STYLE</p>
        <div className="mt-1.5 flex items-center gap-3 rounded-2xl border-2 border-primary-500 bg-white p-2.5">
          <img src={styleImg('knotless-braids')} alt="" className="h-11 w-11 rounded-xl object-cover" />
          <div className="flex-1">
            <p className="text-[13px] font-semibold">Knotless braids</p>
            <p className="text-[10px] text-ink-400">One of Amaka’s styles</p>
          </div>
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-500 text-white">
            <Check size={12} strokeWidth={3} />
          </div>
        </div>

        <p className="mt-4 text-[10px] font-medium tracking-wide text-ink-400">DATE</p>
        <div className="mt-1.5 flex gap-1.5">
          {DAYS.map(({ d, n }) => {
            const on = n === 18
            return (
              <div
                key={n}
                className={`flex flex-1 flex-col items-center rounded-xl py-2 ${on ? 'bg-primary-500 text-white shadow-[0_8px_20px_-8px_rgba(212,137,26,0.9)]' : 'bg-white'}`}
              >
                <span className={`text-[9px] ${on ? 'text-primary-100' : 'text-ink-400'}`}>{d}</span>
                <span className="text-[14px] font-bold">{n}</span>
              </div>
            )
          })}
        </div>

        <p className="mt-4 text-[10px] font-medium tracking-wide text-ink-400">TIME</p>
        <div className="mt-1.5 grid grid-cols-4 gap-1.5">
          {SLOTS.map((t) => {
            const on = t === '11:30'
            const taken = TAKEN.has(t)
            return (
              <div
                key={t}
                className={`rounded-lg py-1.5 text-center text-[11px] font-medium ${
                  on ? 'bg-primary-500 text-white' : taken ? 'bg-ink-700/60 text-ink-600 line-through' : 'bg-white'
                }`}
              >
                {t}
              </div>
            )
          })}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 border-t border-ink-700 bg-white px-4 pb-6 pt-3">
        <div className="mb-2 flex justify-between text-[11px]">
          <span className="text-ink-400">Sat 18 Oct · 11:30</span>
          <span className="font-semibold">₦35,000</span>
        </div>
        <div className="rounded-xl bg-primary-500 py-3 text-center text-[13px] font-semibold text-white">Confirm booking</div>
      </div>
    </div>
  )
}
