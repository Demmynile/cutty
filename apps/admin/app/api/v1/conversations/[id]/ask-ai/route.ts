import { NextResponse } from 'next/server'
import { z } from 'zod'
import { generateText } from 'ai'
import { serverClient } from '@/lib/server/sanity'
import { route, parseBody, HttpError } from '@/lib/server/http'
import { requireCustomer } from '@/lib/server/customerAuth'
import { rateLimit } from '@/lib/server/rateLimit'
import { loadConversationFor, createMessage, broadcast } from '@/lib/server/chat'
import { AI_MODEL, AI_PROVIDER_OPTIONS } from '@/lib/ai/gateway'
import { threadAssistantPrompt } from '@/lib/ai/prompts'

export const runtime = 'nodejs'
export const maxDuration = 60

// The customer asks Cutty AI a question inside their thread with a stylist.
// The question and the AI's answer are both posted to the thread, so the
// stylist sees them too.
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { customerId } = await requireCustomer(req)
  await rateLimit(`ai:thread:${customerId}`, 20, 10 * 60 * 1000)
  const convo = await loadConversationFor((await params).id, { type: 'customer', id: customerId })
  const { question } = await parseBody(req, z.object({ question: z.string().trim().min(2).max(1000) }))

  const ctx = await serverClient.fetch<{
    stylist: { name: string; kind: string; skills?: string[]; styles?: string[]; bookingPrice?: number; bookingDuration?: number }
    messages: Array<{ senderType: string; text: string }>
  }>(
    `{
      "stylist": *[_type == "stylist" && _id == $stylistId][0]{ "name": coalesce(displayName, fullName), kind, skills, styles, bookingPrice, bookingDuration },
      "messages": *[_type == "chatMessage" && conversation._ref == $id] | order(createdAt desc)[0...12]{ senderType, text }
    }`,
    { stylistId: convo.stylistId, id: convo._id },
  )

  const asked = await createMessage({ conversationId: convo._id, senderType: 'customer', senderId: customerId, text: `@Cutty AI ${question}` })
  await broadcast(asked)

  let reply: string
  try {
    const { text } = await generateText({
      model: AI_MODEL,
      maxOutputTokens: 700,
      providerOptions: AI_PROVIDER_OPTIONS,
      system: threadAssistantPrompt(ctx.stylist),
      prompt: `${ctx.messages.reverse().map((m) => `${m.senderType}: ${m.text}`).join('\n')}\n\nCustomer asks Cutty AI: ${question}`,
    })
    reply = text.trim()
  } catch (err) {
    console.error('[ai/thread]', err)
    throw new HttpError(502, 'Cutty AI could not answer right now.')
  }
  if (!reply) throw new HttpError(502, 'Cutty AI could not answer right now.')

  const answer = await createMessage({ conversationId: convo._id, senderType: 'ai', text: reply })
  await broadcast(answer)
  return NextResponse.json({ question: asked, answer })
})
