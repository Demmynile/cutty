import { beforeEach, describe, expect, it } from 'vitest'
import { clerk } from '../stubs/clerk-expo'
import { store } from '../stubs/expo-secure-store'
import { clearAuthData, clerkErrorMessage, getAuthRole, getAuthToken, setAuthRole } from '@/lib/auth'

beforeEach(() => {
  store.clear()
  clerk.session = null
})

describe('getAuthToken', () => {
  it("returns the Clerk session token, or null when signed out or Clerk fails", async () => {
    expect(await getAuthToken()).toBeNull()
    clerk.session = { getToken: async () => 'jwt' }
    expect(await getAuthToken()).toBe('jwt')
    clerk.session = { getToken: async () => { throw new Error('offline') } }
    expect(await getAuthToken()).toBeNull()
  })
})

describe('role', () => {
  it('remembers the role, defaulting to customer', async () => {
    expect(await getAuthRole()).toBe('customer')
    await setAuthRole('stylist')
    expect(await getAuthRole()).toBe('stylist')
    store.set('cutty_auth_role', 'admin')
    expect(await getAuthRole()).toBe('customer')
  })
})

describe('clearAuthData', () => {
  it('signs out of Clerk and removes the role and pre-Clerk keys', async () => {
    clerk.session = { getToken: async () => 'jwt' }
    store.set('cutty_auth_role', 'stylist')
    store.set('cutty_auth_token', 'old')
    store.set('cutty_user_id', 'old')
    store.set('unrelated', 'keep')
    await clearAuthData()
    expect(clerk.signOut).toHaveBeenCalled()
    expect([...store.keys()]).toEqual(['unrelated'])
  })

  it('still clears storage if Clerk sign-out throws', async () => {
    clerk.signOut.mockRejectedValueOnce(new Error('not loaded'))
    store.set('cutty_auth_role', 'customer')
    await clearAuthData()
    expect(store.size).toBe(0)
  })
})

describe('clerkErrorMessage', () => {
  it.each([
    [{ errors: [{ longMessage: 'Long', message: 'Short' }] }, 'Long'],
    [{ errors: [{ message: 'Short' }] }, 'Short'],
    [{ longMessage: 'Top long' }, 'Top long'],
    [new Error('Plain error'), 'Plain error'],
    [{ message: 'Internal', clerkError: true }, 'Fallback'],
    [null, 'Fallback'],
  ])('%o → %s', (err, msg) => {
    expect(clerkErrorMessage(err, 'Fallback')).toBe(msg)
  })
})
