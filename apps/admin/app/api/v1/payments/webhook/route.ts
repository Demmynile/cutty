import { NextResponse } from 'next/server'
import { isValidWebhookSignature, settlePayment } from '@/lib/server/paystack'
import { audit } from '@/lib/server/audit'
import { clientIp } from '@/lib/server/http'

export const runtime = 'nodejs'

// Paystack webhook (set the URL in Paystack Dashboard → Settings → API Keys &
// Webhooks). The signature proves the call came from Paystack; settlePayment
// still re-verifies the transaction with Paystack's API before moving money.
export async function POST(req: Request) {
  const raw = await req.text()
  if (!isValidWebhookSignature(raw, req.headers.get('x-paystack-signature'))) {
    await audit({ action: 'payment.webhook_rejected', actor: { type: 'system', id: 'paystack' }, outcome: 'failure', ip: clientIp(req) })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(raw) as { event: string; data?: { reference?: string } }
  const reference = event.data?.reference
  if (event.event === 'charge.success' && reference && /^cutty_(top|ord)_[a-f0-9]{32}$/.test(reference)) {
    try {
      await settlePayment(reference)
    } catch (err) {
      console.error('[paystack] webhook settle failed', reference, err)
      // Non-2xx makes Paystack retry later.
      return NextResponse.json({ error: 'Retry' }, { status: 500 })
    }
  }
  return NextResponse.json({ ok: true })
}
