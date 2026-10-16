import { Gift, CalendarCheck, Crown, Star } from 'lucide-react'
import { TabBar } from './TabBar'

const EARN = [
  { Icon: CalendarCheck, label: 'Every booking', pts: '+1 pt / ₦100' },
  { Icon: Star, label: 'Gold tier', pts: '15 visits' },
  { Icon: Crown, label: 'Platinum tier', pts: '30 visits' },
]

export function RewardsScreen() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-page text-fg">
      <div className="px-4 pt-[52px]">
        <p className="text-[19px] font-bold">Rewards</p>
        <div className="relative mt-3 overflow-hidden rounded-3xl bg-gradient-to-br from-[#f7d080] via-[#d4891a] to-[#9b490f] p-4 text-white shadow-[0_18px_40px_-18px_rgba(155,73,15,0.9)]">
          <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/20 blur-2xl" />
          <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/80">Gold member</p>
          <p className="mt-1 text-[32px] font-bold leading-none tracking-tight">1,240</p>
          <p className="text-[11px] text-white/80">points</p>
          <div className="mt-4 h-1.5 rounded-full bg-white/25">
            <div className="h-full w-[70%] rounded-full bg-white" />
          </div>
          <p className="mt-1.5 text-[10px] text-white/85">9 visits to Platinum</p>
        </div>

        <p className="mt-4 text-[13px] font-bold">Redeem</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {[
            { t: '₦2,000 off', c: '500 pts' },
            { t: 'Free line-up', c: '900 pts' },
          ].map((r) => (
            <div key={r.t} className="rounded-2xl bg-white p-3">
              <Gift size={16} className="text-primary-500" />
              <p className="mt-2 text-[12px] font-semibold">{r.t}</p>
              <p className="text-[10px] text-ink-400">{r.c}</p>
            </div>
          ))}
        </div>

        <p className="mt-4 text-[13px] font-bold">Ways to earn</p>
        <div className="mt-2 divide-y divide-ink-700 rounded-2xl bg-white">
          {EARN.map(({ Icon, label, pts }) => (
            <div key={label} className="flex items-center gap-2.5 px-3 py-2.5">
              <Icon size={15} className="text-primary-500" />
              <span className="flex-1 text-[11.5px]">{label}</span>
              <span className="text-[10.5px] font-semibold text-primary-400">{pts}</span>
            </div>
          ))}
        </div>
      </div>
      <TabBar active="Rewards" />
    </div>
  )
}
