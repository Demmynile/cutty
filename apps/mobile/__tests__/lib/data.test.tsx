// @vitest-environment jsdom
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppState } from '../stubs/react-native'
import { renderScreen } from '../helpers/screen'
import { routeApi } from '../helpers/api'

vi.mock('@/lib/api', async (orig) => ({ ...(await orig<typeof import('@/lib/api')>()), api: vi.fn() }))
vi.mock('@/lib/realtime', () => ({ disconnectRealtime: vi.fn() }))
vi.mock('@/lib/auth', async (orig) => ({ ...(await orig<typeof import('@/lib/auth')>()), clearAuthData: vi.fn() }))

const { api, ApiError } = await import('@/lib/api')
const data = await import('@/lib/data')
const { useAuthStore } = await import('@/store/authStore')
const { focusManager } = await import('@tanstack/react-query')

// Captured at import, before mockReset clears call history.
const appStateListener = vi.mocked(AppState.addEventListener).mock.calls[0]?.[1]

function Probe({ hook, render }: { hook: () => { data?: unknown; isLoading: boolean }; render?: (d: unknown) => string }) {
  const q = hook()
  return <span>{q.isLoading ? 'loading' : render ? render(q.data) : JSON.stringify(q.data ?? null)}</span>
}

describe('query client defaults', () => {
  const retry = data.createQueryClient().getDefaultOptions().queries!.retry as (n: number, e: unknown) => boolean

  it('retries only transient failures, at most twice', () => {
    expect(retry(0, new ApiError(0, 'offline'))).toBe(true)
    expect(retry(1, new ApiError(503, 'starting'))).toBe(true)
    expect(retry(2, new ApiError(503, 'starting'))).toBe(false)
    expect(retry(0, new ApiError(404, 'gone'))).toBe(false)
    expect(retry(0, new ApiError(400, 'bad'))).toBe(false)
  })

  it('keeps data fresh for 30s and cached for 30 minutes', () => {
    const q = data.createQueryClient().getDefaultOptions().queries!
    expect(q.staleTime).toBe(30_000)
    expect(q.gcTime).toBe(30 * 60_000)
  })

  it('treats the app returning to the foreground as focus', () => {
    expect(appStateListener).toBeTypeOf('function')
    const spy = vi.spyOn(focusManager, 'setFocused')
    appStateListener!('background')
    appStateListener!('active')
    expect(focusManager.isFocused()).toBe(true)
    spy.mockRestore()
  })
})

describe('shared reads', () => {
  beforeEach(() => routeApi(api, { 'GET /api/v1/bookings': [{ _id: 'b1' }] }))

  it('screens showing the same data share one request', async () => {
    await renderScreen(<><Probe hook={data.useBookings} /><Probe hook={data.useBookings} /></>)
    expect(vi.mocked(api).mock.calls.filter(([, p]) => p === '/api/v1/bookings')).toHaveLength(1)
  })

  it('returning to a screen shows cached data instantly, without a request', async () => {
    const first = await renderScreen(<Probe hook={data.useBookings} />)
    await first.unmount()
    vi.mocked(api).mockClear()
    const again = await renderScreen(<Probe hook={data.useBookings} />)
    expect(again.text()).toBe('[{"_id":"b1"}]')
    expect(api).not.toHaveBeenCalled()
  })

  it('invalidate refetches what is on screen', async () => {
    const s = await renderScreen(<Probe hook={data.useBookings} />)
    routeApi(api, { 'GET /api/v1/bookings': [{ _id: 'b2' }] })
    await act(async () => { await data.invalidate(data.keys.bookings) })
    expect(s.text()).toBe('[{"_id":"b2"}]')
  })

  it('availability waits for a barber and date, then is always refetched', async () => {
    routeApi(api, { 'GET /api/v1/availability*': { slots: ['10:00'] } })
    const idle = await renderScreen(<Probe hook={() => data.useAvailability(undefined, null, 30)} />)
    expect(api).not.toHaveBeenCalled()
    await idle.unmount()
    const s = await renderScreen(<Probe hook={() => data.useAvailability('b1', '2026-07-01', 45)} />)
    expect(s.text()).toBe('["10:00"]')
    expect(api).toHaveBeenCalledWith('GET', '/api/v1/availability?barberId=b1&date=2026-07-01&duration=45')
  })

  it('disabled Pro queries make no request', async () => {
    await renderScreen(<><Probe hook={() => data.useProSales(false)} /><Probe hook={() => data.useProProducts(false)} /></>)
    expect(api).not.toHaveBeenCalled()
  })

  it('product slugs are URL-encoded', async () => {
    routeApi(api, { 'GET /api/v1/catalog/products/a%20b': { _id: 'p' } })
    await renderScreen(<Probe hook={() => data.useProduct('a b')} />)
    expect(api).toHaveBeenCalledWith('GET', '/api/v1/catalog/products/a%20b')
  })
})

describe('useRefetchOnFocus', () => {
  it('skips the first focus and refetches on later ones', async () => {
    const refetch = vi.fn()
    let focusCb: (() => void) | undefined
    const router = await import('../stubs/expo-router')
    const spy = vi.spyOn(router, 'useFocusEffect').mockImplementation((cb) => { focusCb = cb as () => void })
    function Screen() {
      data.useRefetchOnFocus(refetch)
      return null
    }
    await renderScreen(<Screen />)
    focusCb!()
    expect(refetch).not.toHaveBeenCalled()
    focusCb!()
    expect(refetch).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })
})

describe('usePullToRefresh', () => {
  it('spins only while the user-requested refetches run, even if one fails', async () => {
    let finish!: () => void
    const slow = vi.fn(() => new Promise<void>((r) => { finish = r }))
    const failing = vi.fn(async () => { throw new Error('offline') })
    let state!: ReturnType<typeof data.usePullToRefresh>
    function Screen() {
      state = data.usePullToRefresh(slow, failing)
      return <span>{String(state.refreshing)}</span>
    }
    const s = await renderScreen(<Screen />)
    expect(s.text()).toBe('false')
    let done!: Promise<void>
    await act(async () => { done = state.onRefresh() })
    expect(s.text()).toBe('true')
    await act(async () => { finish(); await done })
    expect(s.text()).toBe('false')
    expect(slow).toHaveBeenCalledTimes(1)
    expect(failing).toHaveBeenCalledTimes(1)
  })
})

describe('sign out', () => {
  it("clears every cached response so the next account can't see it", async () => {
    data.queryClient.setQueryData(data.keys.wallet, [{ _id: 'secret' }])
    useAuthStore.setState({ customer: { _id: 'c1' } as never, isAuthenticated: true })
    await useAuthStore.getState().signOut()
    expect(data.queryClient.getQueryData(data.keys.wallet)).toBeUndefined()
  })
})
