import 'server-only'
import { generateText } from 'ai'
import { serverClient } from './sanity'
import { createMessage, broadcast } from './chat'
import { freeSlotsForDates, shopNow } from './availability'
import { AI_MODEL, AI_PROVIDER_OPTIONS } from '@/lib/ai/gateway'
import { awayAssistantPrompt, type AwayContext } from '@/lib/ai/prompts'

// Cutty AI answers a customer for a stylist who is offline. The realtime
// server decides "offline" (no connected device) and calls this after a short
// pause; everything else is re-checked here. The model gets no tools, so the
// worst it can do is say something; it can't book, cancel or change anything.

const HISTORY = 30
const MAX_REPLIES_PER_DAY = 15 // per conversation; bounds AI spend if a customer keeps going
const STYLIST_ACTIVE_MS = 2 * 60 * 1000 // the stylist just replied from somewhere: stay quiet
const SLOT_DAYS = 7
const SLOTS_PER_DAY = 8

type Loaded = {
  convo: { _id: string; customerId: string; stylistId: string } | null
  stylist: {
    name: string; kind: string; status?: string; isActive?: boolean; bio?: string; yearsExperience?: number
    skills?: string[]; styles?: string[]; weeklyAvailability?: Array<{ day: string; start: string; end: string }>
    bookingPrice?: number; bookingDuration?: number
    timeOff?: string[]; rating?: number; totalReviews?: number; barberId?: string
    away?: { enabled?: boolean; notes?: string }
    shop?: { status?: string; name?: string; description?: string }
  } | null
  customer: { fullName?: string } | null
  messages: Array<{ senderType: 'customer' | 'stylist' | 'ai'; text: string; createdAt: string }>
}

export type AwayResult = 'sent' | 'disabled' | 'not_needed' | 'stylist_active' | 'daily_limit' | 'no_reply'

export async function replyAsAway(conversationId: string): Promise<AwayResult> {
  const data = await serverClient.fetch<Loaded>(
    `{
      "convo": *[_type == "conversation" && _id == $id][0]{ _id, "customerId": customer._ref, "stylistId": stylist._ref },
      "stylist": *[_type == "conversation" && _id == $id][0].stylist->{
        "name": coalesce(displayName, fullName), kind, status, isActive, bio, yearsExperience, skills, styles,
        weeklyAvailability, timeOff, rating, totalReviews, bookingPrice, bookingDuration, "barberId": barber._ref, "away": awayAssistant,
        "shop": shop{ status, name, description }
      },
      "customer": *[_type == "conversation" && _id == $id][0].customer->{ fullName },
      "messages": *[_type == "chatMessage" && conversation._ref == $id] | order(createdAt desc)[0...${HISTORY}]{ senderType, text, createdAt }
    }`,
    { id: conversationId },
  )
  const { convo, stylist, customer } = data
  if (!convo || !stylist) return 'not_needed'
  if (!stylist.away?.enabled || stylist.status !== 'approved' || stylist.isActive === false) return 'disabled'

  const messages = [...data.messages].reverse() // oldest first
  const last = messages.at(-1)
  if (!last || last.senderType !== 'customer') return 'not_needed'

  const lastStylist = messages.findLast((m) => m.senderType === 'stylist')
  if (lastStylist && Date.now() - Date.parse(lastStylist.createdAt) < STYLIST_ACTIVE_MS) return 'stylist_active'

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const repliesToday = await serverClient.fetch<number>(
    `count(*[_type == "chatMessage" && conversation._ref == $id && senderType == "ai" && createdAt > $since])`,
    { id: conversationId, since: dayAgo },
  )
  if (repliesToday >= MAX_REPLIES_PER_DAY) return 'daily_limit'

  const context = await buildContext(convo, stylist, customer)
  const lastStylistIndex = lastStylist ? messages.lastIndexOf(lastStylist) : -1
  const introduced = messages.slice(lastStylistIndex + 1).some((m) => m.senderType === 'ai')
  const who = { customer: context.customer.firstName || 'Customer', stylist: stylist.name, ai: 'Cutty AI' }

  const { text } = await generateText({
    model: AI_MODEL,
    maxOutputTokens: 800,
    providerOptions: AI_PROVIDER_OPTIONS,
    system: awayAssistantPrompt(context, !introduced),
    prompt: `<conversation>\n${messages.map((m) => `${who[m.senderType]}: ${m.text}`).join('\n')}\n</conversation>\n\nWrite Cutty AI's reply to the customer's latest message(s).`,
  })
  const reply = text.trim()
  if (!reply || reply.includes('NO_REPLY')) return 'no_reply'

  const message = await createMessage({ conversationId, senderType: 'ai', text: reply.slice(0, 4000) })
  await broadcast(message)
  return 'sent'
}

async function buildContext(
  convo: NonNullable<Loaded['convo']>,
  stylist: NonNullable<Loaded['stylist']>,
  customer: Loaded['customer'],
): Promise<AwayContext> {
  const now = shopNow()
  const extra = await serverClient.fetch<{
    products: AwayContext['products']
    bookings: AwayContext['bookings']
  }>(
    `{
      "products": *[_type == "product" && seller._ref == $stylistId && isActive == true] | order(name asc)[0...30]{ name, price, "inStock": coalesce(stock, 0) > 0 },
      "bookings": *[_type == "booking" && customer._ref == $customerId && defined($barberId) && barber._ref == $barberId] | order(bookingDate desc, startTime desc)[0...6]{
        "date": bookingDate, "time": startTime, "status": coalesce(status, "pending"), style
      }
    }`,
    { stylistId: convo.stylistId, customerId: convo.customerId, barberId: stylist.barberId ?? null },
  )

  const slotDuration = stylist.bookingDuration || 60
  const openSlots: AwayContext['openSlots'] = []
  if (stylist.barberId) {
    const days = Array.from({ length: SLOT_DAYS }, (_, i) => addDays(now.date, i))
    const perDay = await freeSlotsForDates(stylist.barberId, days, slotDuration).catch(() => ({} as Record<string, string[]>))
    for (const date of days) {
      const times = perDay[date] ?? []
      if (times.length) openSlots.push({ date: `${weekday(date)} ${date}`, times: times.slice(0, SLOTS_PER_DAY) })
    }
  }

  const hh = String(Math.floor(now.minutes / 60)).padStart(2, '0')
  const mm = String(now.minutes % 60).padStart(2, '0')
  return {
    now: `${weekday(now.date)} ${now.date} ${hh}:${mm}`,
    stylist: {
      ...stylist,
      timeOff: (stylist.timeOff ?? []).filter((d) => d >= now.date).sort().slice(0, 10),
      notes: stylist.away?.notes,
    },
    shop: stylist.shop?.status === 'approved' ? { name: stylist.shop.name, description: stylist.shop.description } : undefined,
    products: extra.products,
    openSlots,
    slotDuration,
    customer: { firstName: customer?.fullName?.trim().split(/\s+/)[0] },
    bookings: extra.bookings,
  }
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function weekday(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })
}
