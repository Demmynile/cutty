import { NextResponse } from 'next/server'
import { z } from 'zod'
import { generateText, APICallError } from 'ai'
import { GatewayError } from '@ai-sdk/gateway'
import type { AITryOnResponse } from '@cutty/types'
import { TRY_ON_STYLES } from '@cutty/types'
import { AI_IMAGE_MODEL } from '@/lib/ai/gateway'
import { guardAIRequest, MAX_IMAGE_BASE64_CHARS } from '@/lib/ai/guard'
import { tryOnPrompt } from '@/lib/ai/prompts'

export const runtime = 'nodejs'
export const maxDuration = 60

const requestSchema = z.object({
  image: z.object({
    base64: z.string().min(1).max(MAX_IMAGE_BASE64_CHARS),
    mediaType: z.enum(['image/jpeg', 'image/png']),
  }),
  styleId: z.string().min(1),
})

export async function POST(req: Request) {
  const denied = await guardAIRequest(req, 'tryon', 10, 60 * 60 * 1000)
  if (denied) return denied

  const body = requestSchema.safeParse(await req.json().catch(() => null))
  if (!body.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const style = TRY_ON_STYLES.find((s) => s.id === body.data.styleId)
  if (!style) {
    return NextResponse.json({ error: 'Unknown style' }, { status: 400 })
  }

  const { image } = body.data

  try {
    const { files, text } = await generateText({
      model: AI_IMAGE_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: tryOnPrompt(style.label, style.prompt) },
            { type: 'file', mediaType: image.mediaType, data: image.base64 },
          ],
        },
      ],
    })

    const generated = files.find((f) => f.mediaType?.startsWith('image/'))
    if (!generated) {
      // The model occasionally responds with a text refusal instead of an image
      // (e.g. it couldn't find a face in the photo).
      console.error('[ai/tryon] no image returned', text?.slice(0, 200))
      return NextResponse.json(
        { error: "Couldn't generate a preview from that photo. Try a clearer, front-facing shot." },
        { status: 502 },
      )
    }

    return NextResponse.json({
      image: {
        base64: generated.base64,
        mediaType: generated.mediaType === 'image/png' ? 'image/png' : 'image/jpeg',
      },
      styleId: style.id,
      caption: `${style.label} · AI preview`,
    } satisfies AITryOnResponse)
  } catch (err) {
    console.error('[ai/tryon]', err)
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
