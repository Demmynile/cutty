import type { ReactNode } from 'react'

/**
 * A 300×620 phone with the app's light theme behind it. Screens are laid out
 * at that fixed size; callers scale the whole frame (see .phone-scale).
 */
export function PhoneFrame({ children, className = '', shadow = true }: { children: ReactNode; className?: string; shadow?: boolean }) {
  return (
    <div
      className={`relative h-[620px] w-[300px] shrink-0 rounded-[52px] bg-[#1b1b1d] p-[10px] ${className}`}
      style={{
        boxShadow: shadow
          ? '0 0 0 1.5px #3a3a3c, inset 0 0 0 1px #000, 0 50px 100px -30px rgba(17,17,17,0.45), 0 30px 60px -40px rgba(184,105,21,0.35)'
          : '0 0 0 1.5px #3a3a3c, inset 0 0 0 1px #000',
      }}
    >
      {/* side buttons */}
      <span className="absolute -left-[3px] top-[110px] h-8 w-[3px] rounded-l bg-[#2c2c2e]" />
      <span className="absolute -left-[3px] top-[160px] h-14 w-[3px] rounded-l bg-[#2c2c2e]" />
      <span className="absolute -left-[3px] top-[226px] h-14 w-[3px] rounded-l bg-[#2c2c2e]" />
      <span className="absolute -right-[3px] top-[180px] h-20 w-[3px] rounded-r bg-[#2c2c2e]" />

      <div className="relative h-full w-full overflow-hidden rounded-[42px] bg-page">
        <StatusBar />
        {/* Dynamic Island */}
        <div className="absolute left-1/2 top-[9px] z-30 h-[26px] w-[88px] -translate-x-1/2 rounded-full bg-black" />
        {children}
        {/* glass sheen */}
        <div className="pointer-events-none absolute inset-0 z-40 rounded-[42px] bg-[linear-gradient(115deg,rgba(255,255,255,0.22)_0%,rgba(255,255,255,0)_38%,rgba(255,255,255,0)_70%,rgba(255,255,255,0.08)_100%)]" />
        {/* home indicator */}
        <div className="absolute bottom-[7px] left-1/2 z-40 h-[4px] w-[104px] -translate-x-1/2 rounded-full bg-fg/80" />
      </div>
    </div>
  )
}

function StatusBar() {
  return (
    <div className="absolute inset-x-0 top-0 z-20 flex h-[44px] items-center justify-between px-7 text-[12px] font-semibold text-fg">
      <span>9:41</span>
      <span className="flex items-center gap-1">
        <svg width="16" height="10" viewBox="0 0 16 10" fill="currentColor" aria-hidden>
          <rect x="0" y="6" width="3" height="4" rx="1" />
          <rect x="4.3" y="4" width="3" height="6" rx="1" />
          <rect x="8.6" y="2" width="3" height="8" rx="1" />
          <rect x="12.9" y="0" width="3" height="10" rx="1" />
        </svg>
        <svg width="22" height="11" viewBox="0 0 22 11" fill="none" aria-hidden>
          <rect x="0.5" y="0.5" width="18" height="10" rx="3" stroke="currentColor" opacity="0.4" />
          <rect x="2" y="2" width="14" height="7" rx="1.8" fill="currentColor" />
          <rect x="19.5" y="3.5" width="1.5" height="4" rx="0.75" fill="currentColor" opacity="0.4" />
        </svg>
      </span>
    </div>
  )
}
