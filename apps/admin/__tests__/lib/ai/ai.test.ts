import { beforeEach, describe, expect, it, vi } from 'vitest'
import { request } from '../../helpers/http'

vi.mock('@/lib/server/customerAuth', () => ({ requireCustomer: vi.fn() }))
vi.mock('@/lib/server/rateLimit', () => ({ rateLimit: vi.fn() }))

const { guardAIRequest, MAX_HISTORY_MESSAGES, MAX_IMAGE_BASE64_CHARS, MAX_MESSAGE_CHARS, MAX_NOTES_CHARS } = await import('@/lib/ai/guard')
const { requireCustomer } = await import('@/lib/server/customerAuth')
const { rateLimit } = await import('@/lib/server/rateLimit')
const { HttpError } = await import('@/lib/server/http')

describe('lib/ai/gateway', () => {
  it('defaults the models and reasoning effort', async () => {
    vi.resetModules()
    const gw = await import('@/lib/ai/gateway')
    expect(gw.AI_MODEL).toBe('anthropic/claude-opus-5')
    expect(gw.AI_IMAGE_MODEL).toBe('google/gemini-2.5-flash-image')
    expect(gw.AI_PROVIDER_OPTIONS).toEqual({ anthropic: { thinking: { type: 'adaptive', effort: 'medium' } } })
  })

  it('reads overrides from the environment', async () => {
    vi.stubEnv('AI_GATEWAY_MODEL', 'anthropic/other')
    vi.stubEnv('AI_GATEWAY_IMAGE_MODEL', 'google/img')
    vi.stubEnv('AI_GATEWAY_EFFORT', 'high')
    vi.resetModules()
    const gw = await import('@/lib/ai/gateway')
    expect(gw.AI_MODEL).toBe('anthropic/other')
    expect(gw.AI_IMAGE_MODEL).toBe('google/img')
    expect(gw.AI_PROVIDER_OPTIONS.anthropic.thinking.effort).toBe('high')
  })
})

describe('lib/ai/guard', () => {
  beforeEach(() => {
    vi.mocked(requireCustomer).mockResolvedValue({ customerId: 'c1', email: 'e', clerkUserId: 'u' })
  })

  it('lets a signed-in customer through and rate-limits per feature and customer', async () => {
    expect(await guardAIRequest(request('POST', '/'), 'chat', 30, 1000)).toBeNull()
    expect(rateLimit).toHaveBeenCalledWith('ai:chat:c1', 30, 1000)
  })

  it('turns auth and rate-limit errors into JSON responses', async () => {
    vi.mocked(requireCustomer).mockRejectedValueOnce(new HttpError(401, 'Please sign in'))
    const denied = await guardAIRequest(request('POST', '/'), 'chat', 30, 1000)
    expect(denied?.status).toBe(401)
    expect(await denied?.json()).toEqual({ error: 'Please sign in' })

    vi.mocked(rateLimit).mockImplementationOnce(() => { throw new HttpError(429, 'slow down') })
    expect((await guardAIRequest(request('POST', '/'), 'chat', 30, 1000))?.status).toBe(429)
  })

  it('rethrows unexpected errors', async () => {
    vi.mocked(requireCustomer).mockRejectedValueOnce(new Error('boom'))
    await expect(guardAIRequest(request('POST', '/'), 'chat', 30, 1000)).rejects.toThrow('boom')
  })

  it('exports sane request limits', () => {
    expect(MAX_MESSAGE_CHARS).toBe(4000)
    expect(MAX_HISTORY_MESSAGES).toBe(20)
    expect(MAX_NOTES_CHARS).toBe(500)
    expect(MAX_IMAGE_BASE64_CHARS).toBe(6_000_000)
  })
})
