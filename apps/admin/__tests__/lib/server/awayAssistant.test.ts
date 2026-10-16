import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sanity } from '../../helpers/sanity'

vi.mock('@/lib/server/sanity', async () => (await import('../../helpers/sanity')).sanityModule)
vi.mock('ai', () => ({ generateText: vi.fn() }))
vi.mock('@/lib/server/chat', () => ({
  createMessage: vi.fn(async (m: object) => ({ _id: 'm-ai', createdAt: 'now', ...m })),
  broadcast: vi.fn(),
}))
vi.mock('@/lib/server/availability', async (orig) => ({
  ...(await orig<typeof import('@/lib/server/availability')>()),
  freeSlotsForDates: vi.fn(async () => ({})),
}))

const { replyAsAway } = await import('@/lib/server/awayAssistant')
const { generateText } = await import('ai')
const { createMessage, broadcast } = await import('@/lib/server/chat')
const { freeSlotsForDates } = await import('@/lib/server/availability')

const NOW = new Date('2026-06-15T10:00:00Z') // Monday 11:00 in Lagos
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString()

const stylist = {
  name: 'Ada', kind: 'braider', status: 'approved', isActive: true, barberId: 'b1', bookingPrice: 2_500_000, bookingDuration: 90,
  away: { enabled: true, notes: 'Studio in Lekki' }, timeOff: ['2026-06-20', '2026-01-01'],
  shop: { status: 'approved', name: 'Ada Hair', description: 'Braids' },
}

function given(opts: { stylist?: object | null; messages?: object[]; aiToday?: number; convo?: object | null } = {}) {
  sanity.on('"convo"', {
    convo: opts.convo === undefined ? { _id: 'cv1', customerId: 'c1', stylistId: 's1' } : opts.convo,
    stylist: opts.stylist === undefined ? stylist : opts.stylist,
    customer: { fullName: '  Bola  Ade ' },
    // newest first, as the query returns them
    messages: opts.messages ?? [{ senderType: 'customer', text: 'How much are knotless braids?', createdAt: ago(60_000) }],
  })
  sanity.on('count(*[_type == "chatMessage"', opts.aiToday ?? 0)
  sanity.on('"products"', {
    products: [{ name: 'Edge gel', price: 300_000, inStock: false }],
    bookings: [],
  })
}

beforeEach(() => {
  sanity.reset()
  vi.useFakeTimers({ now: NOW })
  vi.mocked(generateText).mockResolvedValue({ text: ' Hi Bola! Knotless is ₦25,000. ' } as never)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('replyAsAway', () => {
  it('answers the customer, posts the reply as Cutty AI and broadcasts it', async () => {
    given()
    await expect(replyAsAway('cv1')).resolves.toBe('sent')
    expect(createMessage).toHaveBeenCalledWith({ conversationId: 'cv1', senderType: 'ai', text: 'Hi Bola! Knotless is ₦25,000.' })
    expect(broadcast).toHaveBeenCalledWith(expect.objectContaining({ _id: 'm-ai' }))
  })

  it('grounds the prompt in the stylist context and introduces itself the first time', async () => {
    given()
    await replyAsAway('cv1')
    const { system, prompt } = vi.mocked(generateText).mock.calls[0][0] as { system: string; prompt: string }
    expect(system).toContain('Current time (shop, Lagos): Monday 2026-06-15 11:00')
    expect(system).toContain('Appointment price (book in the app): ₦25,000 for a 90-minute appointment')
    expect(system).toContain('Upcoming days off: 2026-06-20') // past day off dropped
    expect(system).not.toContain('2026-01-01')
    expect(system).toContain('Shop: Ada Hair')
    expect(system).toContain('Edge gel: ₦3,000 (out of stock)')
    expect(system).toContain('Studio in Lekki')
    expect(system).toContain('Start by saying briefly that Ada is away')
    expect(prompt).toContain('Bola: How much are knotless braids?')
  })

  it("looks up open slots for the stylist's appointment length across the next 7 days", async () => {
    vi.mocked(freeSlotsForDates).mockResolvedValue({ '2026-06-16': Array.from({ length: 12 }, (_, i) => `1${i % 10}:00`) })
    given()
    await replyAsAway('cv1')
    expect(freeSlotsForDates).toHaveBeenCalledTimes(1) // one query for the whole week
    expect(freeSlotsForDates).toHaveBeenCalledWith('b1', ['2026-06-15', '2026-06-16', '2026-06-17', '2026-06-18', '2026-06-19', '2026-06-20', '2026-06-21'], 90)
    const { system } = vi.mocked(generateText).mock.calls[0][0] as { system: string }
    expect(system).toContain('Open start times for a 90-minute appointment')
    expect(system).toMatch(/- Tuesday 2026-06-16: (\d\d:00, ){7}\d\d:00\n/) // capped at 8 per day
  })

  it("doesn't re-introduce itself if it already replied since the stylist last spoke", async () => {
    given({
      messages: [
        { senderType: 'customer', text: 'and cornrows?', createdAt: ago(10_000) },
        { senderType: 'ai', text: 'Ada is away…', createdAt: ago(60_000) },
        { senderType: 'customer', text: 'price?', createdAt: ago(70_000) },
        { senderType: 'stylist', text: 'hello', createdAt: ago(60 * 60_000) },
      ],
    })
    await replyAsAway('cv1')
    expect((vi.mocked(generateText).mock.calls[0][0] as { system: string }).system).toContain("You've already introduced yourself")
  })

  it.each([
    ['the conversation is gone', { convo: null }, 'not_needed'],
    ['the stylist has not enabled it', { stylist: { ...stylist, away: { enabled: false } } }, 'disabled'],
    ['the stylist is not approved', { stylist: { ...stylist, status: 'suspended' } }, 'disabled'],
    ['the stylist is deactivated', { stylist: { ...stylist, isActive: false } }, 'disabled'],
    ['the last message is not from the customer', { messages: [{ senderType: 'ai', text: 'x', createdAt: ago(1000) }] }, 'not_needed'],
    ['there are no messages', { messages: [] }, 'not_needed'],
    ['the stylist replied in the last 2 minutes', {
      messages: [
        { senderType: 'customer', text: 'ok', createdAt: ago(10_000) },
        { senderType: 'stylist', text: 'brb', createdAt: ago(60_000) },
      ],
    }, 'stylist_active'],
    ['the daily cap is reached', { aiToday: 15 }, 'daily_limit'],
  ] as const)('stays quiet when %s', async (_label, opts, result) => {
    given(opts as never)
    await expect(replyAsAway('cv1')).resolves.toBe(result)
    expect(generateText).not.toHaveBeenCalled()
    expect(createMessage).not.toHaveBeenCalled()
  })

  it('posts nothing when the model answers NO_REPLY or nothing', async () => {
    given()
    vi.mocked(generateText).mockResolvedValueOnce({ text: 'NO_REPLY' } as never)
    await expect(replyAsAway('cv1')).resolves.toBe('no_reply')
    vi.mocked(generateText).mockResolvedValueOnce({ text: '   ' } as never)
    await expect(replyAsAway('cv1')).resolves.toBe('no_reply')
    expect(createMessage).not.toHaveBeenCalled()
  })

  it('truncates very long replies to 4000 characters', async () => {
    given()
    vi.mocked(generateText).mockResolvedValueOnce({ text: 'x'.repeat(5000) } as never)
    await replyAsAway('cv1')
    expect(vi.mocked(createMessage).mock.calls[0][0].text).toHaveLength(4000)
  })

  it('omits the shop section when the shop is not approved and skips slots without a barber', async () => {
    given({ stylist: { ...stylist, barberId: undefined, shop: { status: 'requested', name: 'Hidden' } } })
    await replyAsAway('cv1')
    const { system } = vi.mocked(generateText).mock.calls[0][0] as { system: string }
    expect(system).not.toContain('Hidden')
    expect(system).toContain('- no open times found')
    expect(freeSlotsForDates).not.toHaveBeenCalled()
  })
})
