import { NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { z as z4 } from 'zod/v4'
import { serverClient } from '@/lib/server/sanity'
import { route, HttpError } from '@/lib/server/http'
import { requireStylist } from '@/lib/server/stylistAuth'
import { rateLimit } from '@/lib/server/rateLimit'
import { loadConversationFor } from '@/lib/server/chat'
import { AI_MODEL, AI_PROVIDER_OPTIONS } from '@/lib/ai/gateway'
import { suggestRepliesPrompt } from '@/lib/ai/prompts'

export const runtime = 'nodejs'
export const maxDuration = 60

const outputSchema = z4.object({ suggestions: z4.array(z4.string()).min(1).max(3) })

// AI-suggested replies for the stylist, grounded in their appointment price,
// styles, skills and hours. Nothing is sent: the stylist picks or edits one.
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { stylistId } = await requireStylist(req, { approved: true })
  await rateLimit(`ai:suggest:${stylistId}`, 30, 10 * 60 * 1000)
  const convo = await loadConversationFor((await params).id, { type: 'stylist', id: stylistId })

  const ctx = await serverClient.fetch<{
    stylist: { name: string; kind: string; skills?: string[]; styles?: string[]; weeklyAvailability?: Array<{ day: string; start: string; end: string }>; bookingPrice?: number; bookingDuration?: number }
    messages: Array<{ senderType: string; text: string }>
  }>(
    `{
      "stylist": *[_type == "stylist" && _id == $stylistId][0]{ "name": coalesce(displayName, fullName), kind, skills, styles, weeklyAvailability, bookingPrice, bookingDuration },
      "messages": *[_type == "chatMessage" && conversation._ref == $id] | order(createdAt desc)[0...20]{ senderType, text }
    }`,
    { stylistId, id: convo._id },
  )
  if (!ctx.messages.length) throw new HttpError(400, 'There are no messages to reply to yet.')

  try {
    const { object } = await generateObject({
      model: AI_MODEL,
      schema: outputSchema,
      providerOptions: AI_PROVIDER_OPTIONS,
      system: suggestRepliesPrompt(ctx.stylist),
      prompt: ctx.messages
        .reverse()
        .map((m) => `${m.senderType === 'stylist' ? 'Stylist' : m.senderType === 'ai' ? 'Cutty AI' : 'Customer'}: ${m.text}`)
        .join('\n'),
    })
    return NextResponse.json(object)
  } catch (err) {
    console.error('[ai/suggest]', err)
    throw new HttpError(502, 'Could not suggest replies right now.')
  }
})
