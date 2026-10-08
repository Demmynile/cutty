import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import { api } from './api'

export type PaymentOutcome = 'completed' | 'pending' | 'failed'

// Opens Paystack's hosted checkout (card details are entered on Paystack's
// page, never in this app), then asks the server to confirm the charge with
// Paystack. The server — not this function — moves the money.
export async function payWithPaystack(authorizationUrl: string, reference: string): Promise<PaymentOutcome> {
  await WebBrowser.openAuthSessionAsync(authorizationUrl, Linking.createURL('payment-complete'))

  // Paystack can take a moment to report success; the webhook will still
  // settle it later if we give up here.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { status } = await api<{ status: PaymentOutcome }>('POST', '/api/v1/payments/verify', { reference })
    if (status !== 'pending') return status
    await new Promise((r) => setTimeout(r, 2000))
  }
  return 'pending'
}
