import { Scissors } from 'lucide-react'

export function Footer() {
  return (
    <footer className="border-t border-black/[0.06]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-10 text-[13px] text-ink-400 sm:flex-row md:px-8">
        <div className="flex items-center gap-2 font-semibold text-fg">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-fg text-[#F1A91F]">
            <Scissors size={13} strokeWidth={2.4} />
          </span>
          Cutty
        </div>
        <p>© {new Date().getFullYear()} Cutty. Made in Lagos.</p>
        <div className="flex gap-6">
          <a href="#features" className="hover:text-fg">Features</a>
          <a href="#pro" className="hover:text-fg">For stylists</a>
          <a href="#waitlist" className="hover:text-fg">Waitlist</a>
        </div>
      </div>
    </footer>
  )
}
