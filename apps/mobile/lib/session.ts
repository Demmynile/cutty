import type { Customer, StylistAccount, StylistKind, StylistLocation } from '@cutty/types'
import { getClerkInstance } from '@clerk/expo'
import { api, ApiError, isTransientError } from './api'
import { getAuthRole, setAuthRole } from './auth'
import { useAuthStore } from '@/store/authStore'

// After Clerk has signed the user in, these load (or create) their Cutty
// account through the API and put it in the auth store. The (auth) layout
// then redirects to the right home screen.

export type CustomerProfile = { fullName?: string; phone?: string }

/** Customer sign-in/up. Creates the customer on first sign-in or links a pre-Clerk account by email. */
export async function enterAsCustomer(profile: CustomerProfile = {}) {
  await setAuthRole('customer')
  const { customer } = await api<{ customer: Customer }>('POST', '/api/v1/auth/session', profile)
  useAuthStore.getState().setCustomer(customer)
}

/**
 * Cutty Pro sign-in. Returns 'needsProfile' when this Clerk user hasn't set up
 * a stylist profile yet (the caller shows the profile step).
 */
export async function enterAsStylist(): Promise<'ok' | 'needsProfile'> {
  await setAuthRole('stylist')
  try {
    const { stylist } = await api<{ stylist: StylistAccount }>('POST', '/api/v1/pro/auth/session')
    useAuthStore.getState().setStylist(stylist)
    return 'ok'
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return 'needsProfile'
    throw err
  }
}

export type StylistProfile = { fullName: string; phone: string; kind: StylistKind; location?: StylistLocation }

/** Creates the Cutty Pro profile for the signed-in Clerk user (pending admin approval). */
export async function createStylistProfile(profile: StylistProfile) {
  await setAuthRole('stylist')
  const { stylist } = await api<{ stylist: StylistAccount }>('POST', '/api/v1/pro/auth/register', profile)
  useAuthStore.getState().setStylist(stylist)
}

/** Reloads the signed-in Cutty account for the role last used on this device. */
export async function refreshAccount() {
  if ((await getAuthRole()) === 'stylist') {
    useAuthStore.getState().setStylist(await api<StylistAccount>('GET', '/api/v1/pro/me'))
  } else {
    await enterAsCustomer()
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Runs `fn`, retrying with backoff while the API is unreachable or starting up
 * (see isTransientError). Gives up after `attempts`, on any other error, or
 * once the Clerk session ends. `onRetry` runs before each wait.
 */
export async function withServerRetry<T>(
  fn: () => Promise<T>,
  { attempts = Infinity, onRetry }: { attempts?: number; onRetry?: () => void } = {},
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (!isTransientError(err) || attempt >= attempts || !getClerkInstance().session) throw err
      onRetry?.()
      await sleep(Math.min(1000 * 2 ** (attempt - 1), 15_000))
    }
  }
}
