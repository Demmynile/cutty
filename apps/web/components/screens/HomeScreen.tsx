import { MessageCircle, Scissors, ChevronRight, Sparkles } from 'lucide-react'
import { TabBar } from './TabBar'
import { styleImg } from '@/lib/content'

const STYLISTS = [
  { name: 'Dayo Adeyemi', img: 'skin-fade', rating: 4.9, reason: 'Sharp skin fades, free Saturday morning near Lekki.' },
  { name: 'Amaka Obi', img: 'knotless-braids', rating: 5.0, reason: 'Knotless braids specialist with 200+ reviews.' },
  { name: 'Tunde Bello', img: 'waves', rating: 4.8, reason: 'Waves and line-ups, 10 min from you.' },
]

export function HomeScreen() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-page text-fg">
      <div className="bg-white px-4 pb-4 pt-[52px]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] text-ink-400">Good evening 👋</p>
            <p className="mt-0.5 text-[19px] font-bold leading-tight">Tolu</p>
          </div>
          <div className="flex items-center gap-3">
            <MessageCircle size={20} />
            <div className="text-right">
              <p className="text-[9px] text-ink-400">Wallet Balance</p>
              <p className="text-[15px] font-bold">₦45,500</p>
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-ink-700 px-3 py-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FFD700]/25 text-[13px]">⭐</div>
          <div className="flex-1">
            <p className="text-[12px] font-semibold">Gold Member</p>
            <p className="text-[10px] text-ink-400">1,240 points available</p>
          </div>
          <span className="text-[11px] font-medium text-primary-400">View →</span>
        </div>
      </div>

      <div className="px-4">
        <p className="mb-2 mt-4 text-[10px] font-medium tracking-wide text-ink-300">UPCOMING APPOINTMENT</p>
        <div className="rounded-2xl bg-primary-500 p-3.5 text-white shadow-[0_10px_30px_-12px_rgba(212,137,26,0.8)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[15px] font-bold">Sat, 18 Oct</p>
              <p className="text-[11px] text-primary-100">11:30 with Dayo Adeyemi</p>
            </div>
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px]">Confirmed</span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between rounded-2xl border border-primary-500 bg-ink-700 p-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500/20 text-primary-500">
              <Scissors size={16} />
            </div>
            <span className="text-[13px] font-semibold">Book an Appointment</span>
          </div>
          <ChevronRight size={16} className="text-primary-500" />
        </div>

        <div className="mt-2.5 flex items-center gap-2 rounded-2xl border border-ink-700 bg-white px-3 py-2.5">
          <Sparkles size={14} className="text-[#F1A91F]" />
          <span className="truncate text-[11px] text-ink-400">Ask Cutty AI: “braids this weekend under ₦30k”</span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between px-4">
        <p className="text-[14px] font-bold">Recommended for you</p>
        <p className="text-[10px] text-primary-400">All stylists →</p>
      </div>
      <div className="no-scrollbar mt-2 flex gap-2.5 overflow-hidden px-4">
        {STYLISTS.map((s) => (
          <div key={s.name} className="w-[170px] shrink-0 rounded-2xl bg-white p-3">
            <div className="flex items-center gap-2">
              <img src={styleImg(s.img)} alt="" className="h-9 w-9 rounded-full object-cover" />
              <div className="min-w-0">
                <p className="truncate text-[12px] font-semibold">{s.name}</p>
                <p className="text-[10px] text-ink-400">★ {s.rating.toFixed(1)}</p>
              </div>
            </div>
            <p className="mt-2 line-clamp-2 text-[10px] leading-snug text-ink-300">{s.reason}</p>
          </div>
        ))}
      </div>
      <TabBar active="Home" />
    </div>
  )
}
