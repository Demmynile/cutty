import * as SecureStore from 'expo-secure-store'
import { getClerkInstance } from '@clerk/expo'

// Customers and Cutty Pro stylists sign in with Clerk (email + password or
// Google). Clerk keeps its session in the keychain/keystore (token cache in
// app/_layout.tsx) and hands out short-lived session tokens, which the API
// and realtime server verify. We only remember which role the user picked.
const ROLE_KEY = 'cutty_auth_role'
// Left behind by pre-Clerk builds.
const LEGACY_KEYS = ['cutty_auth_token', 'cutty_user_id']

export type AuthRole = 'customer' | 'stylist'

/** A fresh Clerk session token (Clerk caches and refreshes it), or null when signed out. */
export async function getAuthToken(): Promise<string | null> {
  try {
    return (await getClerkInstance().session?.getToken()) ?? null
  } catch {
    return null
  }
}

export async function setAuthRole(role: AuthRole) {
  await SecureStore.setItemAsync(ROLE_KEY, role)
}

export async function getAuthRole(): Promise<AuthRole> {
  return (await SecureStore.getItemAsync(ROLE_KEY)) === 'stylist' ? 'stylist' : 'customer'
}

/** Ends the Clerk session on this device and forgets the role. */
export async function clearAuthData() {
  try {
    await getClerkInstance().signOut()
  } catch {
    // Already signed out, or Clerk not loaded yet.
  }
  await SecureStore.deleteItemAsync(ROLE_KEY)
  for (const key of LEGACY_KEYS) await SecureStore.deleteItemAsync(key)
}

/** Readable message from a Clerk error (or anything else thrown during sign-in). */
export function clerkErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.') {
  const e = err as { errors?: Array<{ longMessage?: string; message?: string }>; longMessage?: string; message?: string; clerkError?: boolean } | null
  return e?.errors?.[0]?.longMessage || e?.errors?.[0]?.message || e?.longMessage || (e?.message && !e.clerkError ? e.message : null) || fallback
}
