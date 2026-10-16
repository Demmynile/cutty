import 'server-only'
import type { AvailabilityWindow, Weekday } from '@cutty/types'
import { serverClient } from './sanity'
import { HttpError } from './http'

const WEEKDAY_BY_INDEX: Weekday[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const ACTIVE_STATUSES = ['pending', 'confirmed', 'in_progress']

type BarberSchedule = {
  _id: string
  workingHours?: { start?: string; end?: string }
  workingDays?: string[]
  weeklyAvailability?: AvailabilityWindow[]
  timeOff?: string[]
}

type Settings = { openingTime?: string; closingTime?: string; closedDays?: string[]; bookingSlotInterval?: number }

export function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function toHHMM(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

function weekday(date: string): Weekday {
  // Noon UTC avoids the date shifting across the day boundary in any timezone.
  return WEEKDAY_BY_INDEX[new Date(`${date}T12:00:00Z`).getUTCDay()]
}

// Working windows for one barber on one date. Cutty Pro stylists set
// per-day windows in the app; shop barbers fall back to workingDays/Hours
// from Studio, then to the shop's opening hours.
function windowsFor(barber: BarberSchedule, settings: Settings, date: string): Array<[number, number]> {
  const day = weekday(date)
  if (barber.timeOff?.includes(date)) return []
  if (settings.closedDays?.some((d) => d.toLowerCase() === day) && !barber.weeklyAvailability?.length) return []

  if (barber.weeklyAvailability?.length) {
    return barber.weeklyAvailability
      .filter((w) => w.day === day)
      .map((w) => [toMinutes(w.start), toMinutes(w.end)] as [number, number])
      .filter(([s, e]) => e > s)
  }
  if (barber.workingDays?.length && !barber.workingDays.some((d) => d.toLowerCase() === day)) return []
  const start = barber.workingHours?.start ?? settings.openingTime ?? '09:00'
  const end = barber.workingHours?.end ?? settings.closingTime ?? '19:00'
  return [[toMinutes(start), toMinutes(end)]]
}

type Booked = { _id: string; bookingDate: string; startTime: string; endTime?: string; duration?: number }

// Barber, shop settings and the active bookings for every requested date, in
// one round-trip to Sanity.
async function load(barberId: string, dates: string[]) {
  const { barber, settings, booked } = await serverClient.fetch<{ barber: BarberSchedule | null; settings: Settings | null; booked: Booked[] }>(
    `{
      "barber": *[_type == "barber" && _id == $id][0]{ _id, workingHours, workingDays, weeklyAvailability, timeOff },
      "settings": *[_type == "settings"][0]{ openingTime, closingTime, closedDays, bookingSlotInterval },
      "booked": *[_type == "booking" && barber._ref == $id && bookingDate in $dates && status in $statuses]{
        _id, bookingDate, startTime, endTime
      }
    }`,
    { id: barberId, dates, statuses: ACTIVE_STATUSES },
  )
  if (!barber) throw new HttpError(400, 'That stylist is not available.')
  return { barber, settings: settings ?? {}, booked: booked ?? [] }
}

function busyRanges(booked: Array<{ startTime: string; endTime?: string; duration?: number }>): Array<[number, number]> {
  return booked.map((b) => {
    const start = toMinutes(b.startTime)
    const end = b.endTime ? toMinutes(b.endTime) : start + (b.duration || 30)
    return [start, end]
  })
}

// The shop runs on Lagos time regardless of where the server is hosted.
const SHOP_TZ = process.env.SHOP_TIMEZONE || 'Africa/Lagos'

export function shopNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: SHOP_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  )
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) }
}

const overlaps = (a: [number, number], b: [number, number]) => a[0] < b[1] && b[0] < a[1]

function slotsFor(
  barber: BarberSchedule, settings: Settings, booked: Booked[], date: string, duration: number, now: { date: string; minutes: number },
) {
  const step = settings.bookingSlotInterval || 30
  const busy = busyRanges(booked.filter((b) => b.bookingDate === date))
  const slots: string[] = []
  for (const [open, close] of windowsFor(barber, settings, date)) {
    for (let t = open; t + duration <= close; t += step) {
      if (date === now.date && t <= now.minutes) continue
      if (busy.some((r) => overlaps([t, t + duration], r))) continue
      slots.push(toHHMM(t))
    }
  }
  return slots
}

/** Free start times (HH:mm) for a booking of `duration` minutes. */
export async function freeSlots(barberId: string, date: string, duration: number): Promise<string[]> {
  return (await freeSlotsForDates(barberId, [date], duration))[date]
}

/** Free start times for several dates at once, from a single query. */
export async function freeSlotsForDates(barberId: string, dates: string[], duration: number): Promise<Record<string, string[]>> {
  const { barber, settings, booked } = await load(barberId, dates)
  const now = shopNow()
  return Object.fromEntries(dates.map((d) => [d, slotsFor(barber, settings, booked, d, duration, now)]))
}

/** Throws a 409 unless [time, time + duration) is inside the barber's hours and free. Returns the end time. */
export async function assertSlotFree(barberId: string, date: string, time: string, duration: number): Promise<string> {
  const { barber, settings, booked } = await load(barberId, [date])
  const start = toMinutes(time)
  const range: [number, number] = [start, start + duration]
  const inHours = windowsFor(barber, settings, date).some(([open, close]) => range[0] >= open && range[1] <= close)
  if (!inHours) throw new HttpError(409, 'Your stylist is not working at that time. Please pick another slot.')
  if (busyRanges(booked).some((r) => overlaps(range, r))) {
    throw new HttpError(409, 'That time was just booked. Please pick another slot.')
  }
  return toHHMM(range[1])
}
