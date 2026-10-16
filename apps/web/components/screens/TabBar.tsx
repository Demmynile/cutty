import { Home, CalendarDays, Star, Sparkles, User } from 'lucide-react'

const TABS = [
  { label: 'Home', Icon: Home },
  { label: 'Bookings', Icon: CalendarDays },
  { label: 'Rewards', Icon: Star },
  { label: 'AI', Icon: Sparkles },
  { label: 'Profile', Icon: User },
]

export function TabBar({ active }: { active: string }) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-10 flex h-[74px] items-start justify-around border-t border-ink-700 bg-white/90 px-2 pt-2 backdrop-blur">
      {TABS.map(({ label, Icon }) => {
        const on = label === active
        return (
          <div key={label} className={`flex flex-col items-center gap-0.5 ${on ? 'text-primary-500' : 'text-ink-500'}`}>
            <Icon size={20} strokeWidth={on ? 2.4 : 2} fill={on ? 'currentColor' : 'none'} fillOpacity={on ? 0.15 : 0} />
            <span className="text-[9.5px] font-medium">{label}</span>
          </div>
        )
      })}
    </div>
  )
}
