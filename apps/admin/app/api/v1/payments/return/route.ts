import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Paystack's callback_url. Bounces the in-app browser back to the app; the app
// then calls /api/v1/payments/verify. Nothing is trusted from these params.
export function GET(req: Request) {
  const reference = new URL(req.url).searchParams.get('reference') ?? ''
  const safe = /^cutty_(top|ord)_[a-f0-9]{32}$/.test(reference) ? reference : ''
  return NextResponse.redirect(`cutty://payment-complete?reference=${safe}`, 302)
}
