import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clerk } from '../stubs/clerk-expo'
import { store } from '../stubs/expo-secure-store'

vi.mock('@/lib/api', async (orig) => ({ ...(await orig<typeof import('@/lib/api')>()), api: vi.fn() }))
vi.mock('@/lib/realtime', () => ({ disconnectRealtime: vi.fn() }))

const { api, ApiError } = await import('@/lib/api')
const { createStylistProfile, enterAsCustomer, enterAsStylist, refreshAccount, withServerRetry } = await import('@/lib/session')
const { useAuthStore } = await import('@/store/authStore')

beforeEach(() => {
  store.clear()
  clerk.session = { getToken: async () => 't' }
  useAuthStore.setState({ role: null, customer: null, stylist: null, isAuthenticated: false })
})

describe('enterAsCustomer', () => {
  it('opens the session with the profile and stores the customer', async () => {
    vi.mocked(api).mockResolvedValue({ customer: { _id: 'c1' } })
    await enterAsCustomer({ fullName: 'Ada' })
    expect(api).toHaveBeenCalledWith('POST', '/api/v1/auth/session', { fullName: 'Ada' })
    expect(store.get('cutty_auth_role')).toBe('customer')
    expect(useAuthStore.getState()).toMatchObject({ role: 'customer', customer: { _id: 'c1' } })
  })
})

describe('enterAsStylist', () => {
  it('stores the stylist on success', async () => {
    vi.mocked(api).mockResolvedValue({ stylist: { _id: 's1' } })
    await expect(enterAsStylist()).resolves.toBe('ok')
    expect(store.get('cutty_auth_role')).toBe('stylist')
    expect(useAuthStore.getState().stylist).toEqual({ _id: 's1' })
  })

  it("returns 'needsProfile' on 404 and rethrows other errors", async () => {
    vi.mocked(api).mockRejectedValueOnce(new ApiError(404, 'Set up your profile'))
    await expect(enterAsStylist()).resolves.toBe('needsProfile')
    vi.mocked(api).mockRejectedValueOnce(new ApiError(403, 'Suspended'))
    await expect(enterAsStylist()).rejects.toMatchObject({ status: 403 })
  })
})

describe('createStylistProfile', () => {
  it('registers and stores the new stylist', async () => {
    vi.mocked(api).mockResolvedValue({ stylist: { _id: 's2', status: 'pending' } })
    await createStylistProfile({ fullName: 'Ada', phone: '0801', kind: 'braider' })
    expect(api).toHaveBeenCalledWith('POST', '/api/v1/pro/auth/register', { fullName: 'Ada', phone: '0801', kind: 'braider' })
    expect(useAuthStore.getState().stylist).toMatchObject({ _id: 's2' })
  })
})

describe('refreshAccount', () => {
  it('reloads the stylist account for stylists', async () => {
    store.set('cutty_auth_role', 'stylist')
    vi.mocked(api).mockResolvedValue({ _id: 's1' })
    await refreshAccount()
    expect(api).toHaveBeenCalledWith('GET', '/api/v1/pro/me')
    expect(useAuthStore.getState().stylist).toEqual({ _id: 's1' })
  })

  it('re-enters as a customer otherwise', async () => {
    vi.mocked(api).mockResolvedValue({ customer: { _id: 'c1' } })
    await refreshAccount()
    expect(api).toHaveBeenCalledWith('POST', '/api/v1/auth/session', {})
  })
})

describe('withServerRetry', () => {
  it('retries transient errors with exponential backoff, calling onRetry', async () => {
    vi.useFakeTimers()
    const fn = vi.fn()
      .mockRejectedValueOnce(new ApiError(0, 'offline'))
      .mockRejectedValueOnce(new ApiError(503, 'starting'))
      .mockResolvedValueOnce('ok')
    const onRetry = vi.fn()
    const p = withServerRetry(fn, { onRetry })
    await vi.advanceTimersByTimeAsync(1000)
    expect(fn).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(2000)
    await expect(p).resolves.toBe('ok')
    expect(onRetry).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('gives up on permanent errors, after the attempt limit, or once signed out', async () => {
    await expect(withServerRetry(vi.fn().mockRejectedValue(new ApiError(403, 'no')))).rejects.toMatchObject({ status: 403 })

    vi.useFakeTimers()
    const flaky = vi.fn().mockRejectedValue(new ApiError(0, 'offline'))
    const limited = expect(withServerRetry(flaky, { attempts: 2 })).rejects.toMatchObject({ status: 0 })
    await vi.advanceTimersByTimeAsync(1000)
    await limited
    expect(flaky).toHaveBeenCalledTimes(2)
    vi.useRealTimers()

    clerk.session = null
    const once = vi.fn().mockRejectedValue(new ApiError(0, 'offline'))
    await expect(withServerRetry(once)).rejects.toMatchObject({ status: 0 })
    expect(once).toHaveBeenCalledTimes(1)
  })
})
