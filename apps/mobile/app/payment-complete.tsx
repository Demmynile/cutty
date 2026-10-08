import { Redirect } from 'expo-router'

// Landing route for Paystack's redirect (cutty://payment-complete). Normally
// the in-app browser session captures it first; this covers the cases where
// the OS routes the link to the app instead.
export default function PaymentComplete() {
  return <Redirect href="/(tabs)" />
}
