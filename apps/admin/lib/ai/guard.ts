import { NextResponse } from 'next/server'
import { requireCustomer } from '@/lib/server/customerAuth'
import { rateLimit } from '@/lib/server/rateLimit'
import { HttpError } from '@/lib/server/http'

// The AI routes incur per-call spend, so each one requires a signed-in
// customer and is rate-limited per customer. Returns a response to send back
// when the request is refused, or null to continue.
export async function guardAIRequest(req: Request, feature: string, limit: number, windowMs: number) {
  try {
    const { customerId } = await requireCustomer(req)
    rateLimit(`ai:${feature}:${customerId}`, limit, windowMs)
    return null
  } catch (err) {
    if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status })
    throw err
  }
}

export const MAX_MESSAGE_CHARS = 4000
export const MAX_HISTORY_MESSAGES = 20
export const MAX_NOTES_CHARS = 500
// Base64 is ~4/3 the size of the decoded bytes; this caps the decoded image
// around ~4.5MB, comfortably above what a client-side downscale should ever produce.
export const MAX_IMAGE_BASE64_CHARS = 6_000_000
