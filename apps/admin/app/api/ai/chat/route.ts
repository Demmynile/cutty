import { NextResponse } from 'next/server'
import { z } from 'zod'
import { generateText, APICallError, type ModelMessage } from 'ai'
import { GatewayError } from '@ai-sdk/gateway'
import type { AIChatResponse } from '@cutty/types'
import { AI_MODEL, AI_PROVIDER_OPTIONS } from '@/lib/ai/gateway'
import { guardAIRequest, MAX_MESSAGE_CHARS, MAX_HISTORY_MESSAGES, MAX_IMAGE_BASE64_CHARS } from '@/lib/ai/guard'
import { chatSystemPrompt } from '@/lib/ai/prompts'

export const runtime = 'nodejs'
export const maxDuration = 60

const requestSchema = z.object({
  mode: z.enum(['styling', 'grooming']),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(MAX_MESSAGE_CHARS),
      })
    )
    .min(1)
    .max(MAX_HISTORY_MESSAGES),
  image: z
    .object({
      base64: z.string().max(MAX_IMAGE_BASE64_CHARS),
      mediaType: z.enum(['image/jpeg', 'image/png']),
    })
    .optional(),
})

export async function POST(req: Request) {
  const denied = await guardAIRequest(req, 'chat', 30, 10 * 60 * 1000)
  if (denied) return denied

  const body = requestSchema.safeParse(await req.json().catch(() => null))
  if (!body.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { mode, messages, image } = body.data

  const aiMessages: ModelMessage[] = messages.map((m, i) => {
    const isLast = i === messages.length - 1
    if (isLast && m.role === 'user' && image) {
      return {
        role: 'user',
        content: [
          { type: 'file', mediaType: image.mediaType, data: image.base64 },
          { type: 'text', text: m.content },
        ],
      }
    }
    return { role: m.role, content: m.content }
  })

  try {
    const { text } = await generateText({
      model: AI_MODEL,
      maxOutputTokens: 2048,
      providerOptions: AI_PROVIDER_OPTIONS,
      system: chatSystemPrompt(mode),
      messages: aiMessages,
    })

    const reply = text.trim()

    if (!reply) {
      return NextResponse.json({ error: 'AI returned an empty response' }, { status: 502 })
    }

    return NextResponse.json({ reply } satisfies AIChatResponse)
  } catch (err) {
    console.error('[ai/chat]', err)
    // GatewayError covers failures from AI Gateway itself (auth, rate limit,
    // routing); APICallError covers errors passed through from the provider.
    if (GatewayError.isInstance(err) || APICallError.isInstance(err)) {
      if (err.statusCode === 429) {
        return NextResponse.json({ error: 'AI service is busy, try again shortly' }, { status: 429 })
      }
      return NextResponse.json({ error: 'AI service error' }, { status: 502 })
    }
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
