import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth', () => ({ getAuthToken: vi.fn() }))

const { ApiError, api, errorMessage, isTransientError, setUnauthorizedHandler } = await import('@/lib/api')
const { getAuthToken } = await import('@/lib/auth')

const reply = (status: number, body: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status })
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn(async () => reply(200, { ok: true }))
  vi.stubGlobal('fetch', fetchMock)
  vi.mocked(getAuthToken).mockResolvedValue('tok')
})

describe('api', () => {
  it('calls the dev-host API URL with the bearer token and JSON body', async () => {
    await expect(api('POST', '/api/v1/orders', { a: 1 })).resolves.toEqual({ ok: true })
    const [url, init] = fetchMock.mock.calls[0]
    // EXPO_PUBLIC_API_URL is localhost; in dev it is swapped for Metro's LAN host.
    expect(url).toBe('http://192.168.1.50:3002/api/v1/orders')
    expect(init).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' },
      body: '{"a":1}',
    })
  })

  it('omits the body, content type and auth header when not needed', async () => {
    vi.mocked(getAuthToken).mockResolvedValue(null)
    await api('GET', '/api/v1/catalog/services')
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'GET', headers: {}, body: undefined })
  })

  it("throws ApiError with the server's message", async () => {
    fetchMock.mockResolvedValue(reply(400, { error: 'Bad code' }))
    await expect(api('POST', '/x', {})).rejects.toEqual(new ApiError(400, 'Bad code'))
    fetchMock.mockResolvedValue(new Response('<html>', { status: 502 }))
    await expect(api('GET', '/x')).rejects.toMatchObject({ status: 502, message: 'Request failed. Please try again.' })
  })

  it('notifies the unauthorized handler on a 401 only when a token was sent', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    fetchMock.mockResolvedValue(reply(401, { error: 'expired' }))
    await expect(api('GET', '/x')).rejects.toMatchObject({ status: 401 })
    expect(handler).toHaveBeenCalledTimes(1)

    vi.mocked(getAuthToken).mockResolvedValue(null)
    await expect(api('GET', '/x')).rejects.toMatchObject({ status: 401 })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('maps network failures and timeouts to status 0', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'))
    await expect(api('GET', '/x')).rejects.toMatchObject({ status: 0, message: 'Could not reach Cutty. Check your connection.' })

    vi.useFakeTimers()
    fetchMock.mockImplementation((_u: string, init: RequestInit) => new Promise((_, reject) => {
      init.signal!.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
    }))
    const pending = expect(api('GET', '/x', undefined, 50)).rejects.toMatchObject({ status: 0, message: 'Request timed out, try again' })
    await vi.advanceTimersByTimeAsync(60)
    await pending
    vi.useRealTimers()
  })
})

describe('isTransientError', () => {
  it.each([
    [new ApiError(0, ''), true],
    [new ApiError(401, ''), true],
    [new ApiError(429, ''), true],
    [new ApiError(503, ''), true],
    [new ApiError(400, ''), false],
    [new ApiError(403, ''), false],
    [new ApiError(404, ''), false],
    [new Error('random'), true],
  ])('%o → %s', (err, transient) => {
    expect(isTransientError(err)).toBe(transient)
  })
})

describe('errorMessage', () => {
  it('shows API messages and hides everything else', () => {
    expect(errorMessage(new ApiError(400, 'Nope'))).toBe('Nope')
    expect(errorMessage(new Error('stack trace'))).toBe('Something went wrong. Please try again.')
    expect(errorMessage(null, 'Custom')).toBe('Custom')
  })
})
