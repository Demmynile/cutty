import { NextResponse } from 'next/server'
import { z } from 'zod'
import { z as z4 } from 'zod/v4'
import { generateObject, APICallError, NoObjectGeneratedError } from 'ai'
import { GatewayError } from '@ai-sdk/gateway'
import { AI_MODEL, AI_PROVIDER_OPTIONS } from '@/lib/ai/gateway'
import { guardAIRequest, MAX_NOTES_CHARS, MAX_IMAGE_BASE64_CHARS } from '@/lib/ai/guard'
import { ANALYZE_SYSTEM_PROMPT } from '@/lib/ai/prompts'

export const runtime = 'nodejs'
export const maxDuration = 60

const requestSchema = z.object({
  image: z.object({
    base64: z.string().min(1).max(MAX_IMAGE_BASE64_CHARS),
    mediaType: z.enum(['image/jpeg', 'image/png']),
  }),
  notes: z.string().max(MAX_NOTES_CHARS).optional(),
})

const recommendationSchema = z4.object({
  style: z4.string(),
  reasoning: z4.string(),
  maintenanceTips: z4.string(),
  matchedServiceCategory: z4.enum(['haircut', 'shave', 'styling', 'treatment', 'combo', 'braiding', 'wig']).optional(),
})

const analysisSchema = z4.object({
  faceShapeRead: z4.string(),
  hairTypeRead: z4.string(),
  recommendations: z4.array(recommendationSchema).min(2).max(4),
  generalMaintenanceTips: z4.array(z4.string()),
  disclaimer: z4.string(),
})

export async function POST(req: Request) {
  const denied = await guardAIRequest(req, 'analyze', 10, 60 * 60 * 1000)
  if (denied) return denied

  const body = requestSchema.safeParse(await req.json().catch(() => null))
  if (!body.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { image, notes } = body.data

  try {
    const { object } = await generateObject({
      model: AI_MODEL,
      schema: analysisSchema,
      providerOptions: AI_PROVIDER_OPTIONS,
      system: ANALYZE_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'file', mediaType: image.mediaType, data: image.base64 },
            { type: 'text', text: notes ? `What I'm going for: ${notes}` : 'Analyze my hair and suggest styles.' },
          ],
        },
      ],
    })

    return NextResponse.json(object)
  } catch (err) {
    console.error('[ai/analyze]', err)
    if (NoObjectGeneratedError.isInstance(err)) {
      return NextResponse.json({ error: 'Analysis failed, try again' }, { status: 502 })
    }
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
