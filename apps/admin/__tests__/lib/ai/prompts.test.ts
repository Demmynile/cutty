import { describe, expect, it } from 'vitest'
import {
  AI_SEARCH_SYSTEM_PROMPT, ANALYZE_SYSTEM_PROMPT, GROOMING_SYSTEM_PROMPT, STYLING_SYSTEM_PROMPT,
  awayAssistantPrompt, awayContextBlock, chatSystemPrompt, suggestRepliesPrompt, threadAssistantPrompt, tryOnPrompt,
  type AwayContext,
} from '@/lib/ai/prompts'

const stylist = { name: 'Ada', kind: 'both', skills: ['braids'], styles: [], weeklyAvailability: [{ day: 'monday', start: '09:00', end: '17:00' }], bookingPrice: 2_500_000, bookingDuration: 240 }

const ctx: AwayContext = {
  now: 'Monday 2026-06-15 11:00',
  stylist: { name: 'Ada', kind: 'braider', yearsExperience: 6, rating: 4.86, totalReviews: 21, timeOff: [], skills: [], styles: ['locs'], bookingPrice: 1_000_000, bookingDuration: 120 },
  products: [{ name: 'Oil', price: 250_000, inStock: true }],
  openSlots: [{ date: 'Tuesday 2026-06-16', times: ['10:00', '12:00'] }],
  slotDuration: 120,
  customer: {},
  bookings: [{ date: '2026-05-01', time: '10:00', status: 'completed' }, { date: '2026-04-01', time: '12:00', status: 'completed', style: 'Locs' }],
}

describe('chat prompts', () => {
  it('picks the system prompt by mode', () => {
    expect(chatSystemPrompt('grooming')).toBe(GROOMING_SYSTEM_PROMPT)
    expect(chatSystemPrompt('styling')).toBe(STYLING_SYSTEM_PROMPT)
  })

  it('grooming refuses medical advice; analysis lists every style category', () => {
    expect(GROOMING_SYSTEM_PROMPT).toMatch(/Never give medical/)
    for (const c of ['haircut', 'shave', 'styling', 'treatment', 'combo', 'braiding', 'wig']) expect(ANALYZE_SYSTEM_PROMPT).toContain(c)
  })

  it('search prompt forbids invented ids', () => {
    expect(AI_SEARCH_SYSTEM_PROMPT).toMatch(/Never invent ids/)
  })

  it('try-on prompt names the style and preserves identity', () => {
    const p = tryOnPrompt('Buzz cut', 'very short all over')
    expect(p).toContain('Buzz cut — very short all over')
    expect(p).toMatch(/Change ONLY the hair/)
  })
})

describe('stylist-grounded prompts', () => {
  it('describe the stylist, prices in naira and hours', () => {
    for (const p of [suggestRepliesPrompt(stylist), threadAssistantPrompt(stylist)]) {
      expect(p).toContain('Stylist: Ada (barber and braider)')
      expect(p).toContain('Appointment price: ₦25,000 for a 240-minute appointment')
      expect(p).toContain('Styles they do: not listed')
      expect(p).toContain('Weekly hours: monday 09:00–17:00')
    }
  })

  it('handle a stylist with nothing listed', () => {
    const p = suggestRepliesPrompt({ name: 'B', kind: 'barber' })
    expect(p).toContain('Appointment price: not set yet')
    expect(p).not.toContain('Weekly hours')
    expect(suggestRepliesPrompt({ name: 'B', kind: 'barber', weeklyAvailability: [] })).toContain('Weekly hours: not set')
  })
})

describe('away assistant prompt', () => {
  it('lists only facts the stylist gave', () => {
    const block = awayContextBlock(ctx)
    expect(block).toContain("Stylist: Ada (braider), 6 years' experience, rated 4.9/5 from 21 reviews")
    expect(block).toContain('Bio: not written')
    expect(block).toContain('Skills: not listed')
    expect(block).toContain('Appointment price (book in the app): ₦10,000 for a 120-minute appointment')
    expect(block).not.toMatch(/service/i)
    expect(block).toContain('- Tuesday 2026-06-16: 10:00, 12:00')
    expect(block).toContain('Customer: name not given')
    expect(block).toContain('- 2026-05-01 10:00, completed: style not recorded')
    expect(block).toContain('- 2026-04-01 12:00, completed: Locs')
    expect(block).not.toContain('Shop:') // no shop → no products
    expect(block).not.toContain('Oil')
  })

  it('includes the shop, out-of-stock flags and the stylist notes when present', () => {
    const block = awayContextBlock({
      ...ctx,
      shop: { name: 'Ada Hair' },
      products: [{ name: 'Oil', price: 250_000, inStock: false }],
      stylist: { ...ctx.stylist, notes: 'Lekki Phase 1' },
    })
    expect(block).toContain('Shop: Ada Hair')
    expect(block).toContain('- Oil: ₦2,500 (out of stock)')
    expect(block).toMatch(/own notes for you[\s\S]*\nLekki Phase 1$/)
  })

  it('handles no price, slots or bookings', () => {
    const block = awayContextBlock({ ...ctx, stylist: { ...ctx.stylist, bookingPrice: undefined }, openSlots: [], bookings: [], shop: { name: 'S' }, products: [] })
    expect(block).toContain('Appointment price (book in the app): not set yet')
    expect(block).toContain('- no open times found')
    expect(block).toContain('- no products listed')
    expect(block).toMatch(/newest first\):\n- none/)
  })

  it('introduces itself only on the first reply and forbids taking actions', () => {
    const first = awayAssistantPrompt(ctx, true)
    const later = awayAssistantPrompt(ctx, false)
    expect(first).toContain('Start by saying briefly that Ada is away')
    expect(later).toContain("You've already introduced yourself")
    expect(first).toContain('<context>')
    expect(first).toMatch(/book, hold, reschedule or cancel/)
    expect(first).toContain('NO_REPLY')
  })
})
