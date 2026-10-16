import { NextResponse } from 'next/server'
import { z } from 'zod'
import { WEEKDAYS } from '@cutty/types'
import { serverClient } from '@/lib/server/sanity'
import { route, parseBody, HttpError } from '@/lib/server/http'
import { requireStylist } from '@/lib/server/stylistAuth'
import { loadAccount, syncBarber } from '@/lib/server/stylists'
import { toMinutes } from '@/lib/server/availability'

export const runtime = 'nodejs'

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const schema = z.object({
  weeklyAvailability: z
    .array(z.object({ day: z.enum(WEEKDAYS as [string, ...string[]]), start: time, end: time }))
    .max(21),
  timeOff: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(120),
})

// Replaces the stylist's weekly hours and days off. Bookings already made
// are kept; new bookings are checked against these windows.
export const PUT = route(async (req) => {
  const { stylistId } = await requireStylist(req)
  const { weeklyAvailability, timeOff } = await parseBody(req, schema)

  for (const w of weeklyAvailability) {
    if (toMinutes(w.end) <= toMinutes(w.start)) throw new HttpError(400, `${w.day}: end time must be after start time.`)
  }
  for (const day of WEEKDAYS) {
    const windows = weeklyAvailability.filter((w) => w.day === day).map((w) => [toMinutes(w.start), toMinutes(w.end)]).sort((a, b) => a[0] - b[0])
    for (let i = 1; i < windows.length; i++) {
      if (windows[i][0] < windows[i - 1][1]) throw new HttpError(400, `${day}: time windows overlap.`)
    }
  }

  await serverClient
    .patch(stylistId)
    .set({
      weeklyAvailability: weeklyAvailability.map((w, i) => ({ _key: `${w.day}-${i}`, ...w })),
      timeOff: [...new Set(timeOff)].sort(),
    })
    .commit()
  await syncBarber(stylistId)
  return NextResponse.json(await loadAccount(stylistId))
})
