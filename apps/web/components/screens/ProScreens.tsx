import { TrendingUp, Bot, ChevronLeft } from 'lucide-react'
import { styleImg } from '@/lib/content'

const SCHEDULE = [
  { t: '09:00', who: 'Kemi A.', what: 'Knotless braids', img: 'knotless-braids', done: true },
  { t: '13:30', who: 'Ife O.', what: 'Silk press', img: 'silk-press', now: true },
  { t: '16:00', who: 'Bisi T.', what: 'Senegalese twists', img: 'senegalese-twists' },
]

export function ProDashboardScreen() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-page text-fg">
      <div className="bg-[#111111] px-4 pb-5 pt-[52px] text-white">
        <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-[#F1A91F]">Cutty Pro</p>
        <p className="mt-1 text-[11px] text-white/60">Earned this week</p>
        <p className="text-[28px] font-bold leading-tight tracking-tight">₦184,500</p>
        <p className="mt-0.5 flex items-center gap-1 text-[10px] text-emerald-400">
          <TrendingUp size={11} /> 18% vs last week
        </p>
        <div className="mt-3 flex h-12 items-end gap-1.5">
          {[38, 52, 30, 70, 58, 90, 64].map((h, n) => (
            <div key={n} className={`flex-1 rounded-t ${n === 5 ? 'bg-[#F1A91F]' : 'bg-white/20'}`} style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 px-4 pt-3">
        {[
          { k: 'Today', v: '3' },
          { k: 'Rating', v: '4.9' },
          { k: 'Repeat', v: '72%' },
        ].map((s) => (
          <div key={s.k} className="rounded-xl bg-white p-2.5">
            <p className="text-[9.5px] text-ink-400">{s.k}</p>
            <p className="text-[16px] font-bold">{s.v}</p>
          </div>
        ))}
      </div>
      <p className="px-4 pt-4 text-[13px] font-bold">Today’s chair</p>
      <div className="space-y-2 px-4 pt-2">
        {SCHEDULE.map((s) => (
          <div key={s.t} className={`flex items-center gap-2.5 rounded-2xl p-2.5 ${s.now ? 'bg-primary-500 text-white' : 'bg-white'}`}>
            <span className={`w-9 text-[10.5px] font-semibold ${s.now ? 'text-white' : 'text-ink-400'}`}>{s.t}</span>
            <img src={styleImg(s.img)} alt="" className="h-8 w-8 rounded-full object-cover" />
            <div className="flex-1">
              <p className="text-[11.5px] font-semibold">{s.who}</p>
              <p className={`text-[10px] ${s.now ? 'text-primary-100' : 'text-ink-400'}`}>{s.what}</p>
            </div>
            <span className={`text-[9.5px] ${s.now ? 'rounded-full bg-white/20 px-2 py-0.5' : s.done ? 'text-emerald-600' : 'text-ink-400'}`}>
              {s.now ? 'Now' : s.done ? 'Done' : 'Next'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ProChatScreen() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-page text-fg">
      <div className="flex items-center gap-2 bg-white px-4 pb-3 pt-[52px]">
        <ChevronLeft size={20} />
        <img src={styleImg('afro-women')} alt="" className="h-8 w-8 rounded-full object-cover" />
        <div>
          <p className="text-[13px] font-bold leading-tight">Chioma N.</p>
          <p className="text-[9.5px] text-emerald-600">Online</p>
        </div>
      </div>
      <div className="space-y-2.5 px-3.5 pt-3 text-[11.5px] leading-snug">
        <div className="w-fit max-w-[80%] rounded-2xl rounded-bl-md bg-white px-3 py-2">Hi! Do you do bantu knots on 4C hair? How long does it take?</div>
        <div className="w-fit max-w-[84%] rounded-2xl rounded-bl-md border border-primary-200 bg-primary-50 px-3 py-2">
          <p className="mb-1 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-primary-600">
            <Bot size={10} /> Away assistant
          </p>
          Yes! Bantu knots take about 2 hrs and start at ₦15,000. I have Friday 3pm open. Want me to hold it?
        </div>
        <div className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-primary-500 px-3 py-2 text-white">Yes please, Friday works 🙌</div>
        <div className="mx-auto w-fit rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-medium text-emerald-700">Booked · Fri 17 Oct, 15:00</div>
      </div>
    </div>
  )
}
