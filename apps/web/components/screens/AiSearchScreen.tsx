import { ChevronLeft, Sparkles, Send } from 'lucide-react'
import { styleImg } from '@/lib/content'

const RESULTS = [
  { name: 'Amaka Obi', img: 'knotless-braids', price: '₦28,000', when: 'Sat 10:00', reason: 'Knotless braids, mid-back. 5.0 from 214 reviews.' },
  { name: 'Zainab Musa', img: 'senegalese-twists', price: '₦24,500', when: 'Sun 13:00', reason: 'Twists & box braids, 2.1 km from you.' },
]

export function AiSearchScreen() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-page text-fg">
      <div className="flex items-center gap-2 bg-white px-4 pb-3 pt-[52px]">
        <ChevronLeft size={20} />
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-500/15">
          <Sparkles size={14} className="text-primary-500" />
        </div>
        <div>
          <p className="text-[14px] font-bold leading-tight">Find a Stylist</p>
          <p className="text-[9.5px] text-ink-400">Cutty AI</p>
        </div>
      </div>

      <div className="space-y-2.5 px-3.5 pt-3">
        <div className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-primary-500 px-3 py-2 text-[12px] text-white">
          braids this weekend under ₦30k, somewhere near Lekki
        </div>
        <div className="w-fit max-w-[88%] rounded-2xl rounded-bl-md bg-white px-3 py-2 text-[12px] leading-snug">
          Found <b>2 stylists</b> with knotless or box braids free this weekend, both under ₦30,000 and within 5 km.
        </div>

        {RESULTS.map((r) => (
          <div key={r.name} className="rounded-2xl bg-white p-2.5 shadow-[0_6px_20px_-12px_rgba(0,0,0,0.25)]">
            <div className="flex gap-2.5">
              <img src={styleImg(r.img)} alt="" className="h-14 w-14 rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-semibold">{r.name}</p>
                  <p className="text-[11px] font-bold">{r.price}</p>
                </div>
                <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-ink-400">{r.reason}</p>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[9.5px] font-medium text-primary-600">Next: {r.when}</span>
              <span className="rounded-lg bg-primary-500 px-3 py-1 text-[10.5px] font-semibold text-white">Book</span>
            </div>
          </div>
        ))}

        <div className="flex w-fit items-center gap-1 rounded-2xl rounded-bl-md bg-white px-3 py-2.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="typing-dot h-1.5 w-1.5 rounded-full bg-ink-400" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 bg-white px-3 pb-6 pt-2.5">
        <div className="flex items-center gap-2 rounded-full border border-ink-700 bg-page px-3.5 py-2">
          <span className="flex-1 text-[11px] text-ink-500">Ask anything…</span>
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-500 text-white">
            <Send size={11} />
          </div>
        </div>
      </div>
    </div>
  )
}
