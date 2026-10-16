import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sanity } from '../../helpers/sanity'

vi.mock('@/lib/server/sanity', async () => (await import('../../helpers/sanity')).sanityModule)

const { assertSlotFree, freeSlots, freeSlotsForDates, shopNow, toHHMM, toMinutes } = await import('@/lib/server/availability')

// 2026-06-15 is a Monday; 2026-06-14 a Sunday.
const MONDAY = '2026-06-15'
const SUNDAY = '2026-06-14'

// Barber, settings and bookings arrive together from one query. Bookings
// without a date are on MONDAY.
function given(opts: { barber?: object | null; settings?: object | null; booked?: Array<Record<string, unknown>> }) {
  sanity.on('"booked"', {
    barber: opts.barber === undefined ? { _id: 'b1' } : opts.barber,
    settings: opts.settings ?? null,
    booked: (opts.booked ?? []).map((b) => ({ bookingDate: MONDAY, ...b })),
  })
}

beforeEach(() => {
  sanity.reset()
  // A week before MONDAY, so "today" filtering doesn't apply unless a test opts in.
  vi.useFakeTimers({ now: new Date('2026-06-08T08:00:00Z') })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('time helpers', () => {
  it('converts between HH:mm and minutes', () => {
    expect(toMinutes('09:30')).toBe(570)
    expect(toMinutes('00:00')).toBe(0)
    expect(toHHMM(570)).toBe('09:30')
    expect(toHHMM(5)).toBe('00:05')
  })

  it('shopNow reports Lagos time (UTC+1)', () => {
    vi.setSystemTime(new Date('2026-06-15T23:30:00Z'))
    expect(shopNow()).toEqual({ date: '2026-06-16', minutes: 30 })
  })
})

describe('freeSlots', () => {
  it('falls back to 09:00–19:00 every 30 minutes', async () => {
    given({})
    const slots = await freeSlots('b1', MONDAY, 60)
    expect(slots[0]).toBe('09:00')
    expect(slots.at(-1)).toBe('18:00')
    expect(slots).toHaveLength(19)
  })

  it("uses the shop's hours and slot interval", async () => {
    given({ settings: { openingTime: '10:00', closingTime: '12:00', bookingSlotInterval: 45 } })
    expect(await freeSlots('b1', MONDAY, 30)).toEqual(['10:00', '10:45', '11:30'])
  })

  it("prefers the barber's own working hours over the shop's", async () => {
    given({ barber: { _id: 'b1', workingHours: { start: '14:00', end: '15:00' } }, settings: { openingTime: '08:00', closingTime: '20:00' } })
    expect(await freeSlots('b1', MONDAY, 30)).toEqual(['14:00', '14:30'])
  })

  it('skips booked ranges, using endTime or a stored duration', async () => {
    given({
      settings: { openingTime: '09:00', closingTime: '12:00' },
      booked: [
        { _id: 'x', startTime: '09:30', endTime: '10:00' },
        { _id: 'y', startTime: '11:00', duration: 60 },
      ],
    })
    expect(await freeSlots('b1', MONDAY, 30)).toEqual(['09:00', '10:00', '10:30'])
  })

  it('assumes 30 minutes for a booking with neither endTime nor duration', async () => {
    given({ settings: { openingTime: '09:00', closingTime: '10:00' }, booked: [{ _id: 'x', startTime: '09:00' }] })
    expect(await freeSlots('b1', MONDAY, 30)).toEqual(['09:30'])
  })

  it('returns nothing on a day off, a non-working day or a closed day', async () => {
    given({ barber: { _id: 'b1', timeOff: [MONDAY] } })
    expect(await freeSlots('b1', MONDAY, 30)).toEqual([])

    sanity.reset()
    given({ barber: { _id: 'b1', workingDays: ['Tuesday', 'Wednesday'] } })
    expect(await freeSlots('b1', MONDAY, 30)).toEqual([])

    sanity.reset()
    given({ settings: { closedDays: ['Sunday'] } })
    expect(await freeSlots('b1', SUNDAY, 30)).toEqual([])
  })

  it("uses a Cutty Pro stylist's weekly windows, even on the shop's closed day", async () => {
    given({
      barber: {
        _id: 'b1',
        weeklyAvailability: [
          { day: 'sunday', start: '10:00', end: '11:00' },
          { day: 'sunday', start: '15:00', end: '16:00' },
          { day: 'sunday', start: '18:00', end: '17:00' }, // invalid window is ignored
          { day: 'monday', start: '09:00', end: '17:00' },
        ],
      },
      settings: { closedDays: ['sunday'] },
    })
    expect(await freeSlots('b1', SUNDAY, 60)).toEqual(['10:00', '15:00'])
  })

  it('drops past slots when the date is today in Lagos', async () => {
    vi.setSystemTime(new Date(`${MONDAY}T09:10:00Z`)) // 10:10 in Lagos
    given({ settings: { openingTime: '09:00', closingTime: '12:00' } })
    expect(await freeSlots('b1', MONDAY, 30)).toEqual(['10:30', '11:00', '11:30'])
  })

  it('400s for an unknown barber', async () => {
    given({ barber: null })
    await expect(freeSlots('nobody', MONDAY, 30)).rejects.toMatchObject({ status: 400 })
  })

  it('loads barber, settings and active bookings in a single query', async () => {
    given({})
    await freeSlots('b1', MONDAY, 30)
    expect(sanity.client.fetch).toHaveBeenCalledTimes(1)
    expect(sanity.client.fetch.mock.calls[0][1]).toEqual({ id: 'b1', dates: [MONDAY], statuses: ['pending', 'confirmed', 'in_progress'] })
  })
})

describe('freeSlotsForDates', () => {
  it('computes several days from one query, applying each day’s bookings', async () => {
    given({
      settings: { openingTime: '09:00', closingTime: '10:00' },
      booked: [{ _id: 'x', startTime: '09:00', endTime: '09:30' }, { _id: 'y', bookingDate: '2026-06-16', startTime: '09:30', endTime: '10:00' }],
    })
    expect(await freeSlotsForDates('b1', [MONDAY, '2026-06-16'], 30)).toEqual({ [MONDAY]: ['09:30'], '2026-06-16': ['09:00'] })
    expect(sanity.client.fetch).toHaveBeenCalledTimes(1)
  })
})

describe('assertSlotFree', () => {
  it('returns the end time for a free slot inside working hours', async () => {
    given({})
    await expect(assertSlotFree('b1', MONDAY, '10:00', 45)).resolves.toBe('10:45')
  })

  it('409s outside working hours', async () => {
    given({})
    await expect(assertSlotFree('b1', MONDAY, '18:30', 60)).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/not working/) })
  })

  it('409s when the slot overlaps an existing booking', async () => {
    given({ booked: [{ _id: 'x', startTime: '10:30', endTime: '11:00' }] })
    await expect(assertSlotFree('b1', MONDAY, '10:00', 45)).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/just booked/) })
  })

  it('allows a booking that starts exactly when another ends', async () => {
    given({ booked: [{ _id: 'x', startTime: '09:00', endTime: '10:00' }] })
    await expect(assertSlotFree('b1', MONDAY, '10:00', 30)).resolves.toBe('10:30')
  })
})
