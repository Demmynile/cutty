import { describe, expect, it, vi } from 'vitest'

vi.mock('@clerk/backend', () => ({ verifyToken: vi.fn() }))

const { verifyToken: verifyClerkToken } = await import('@clerk/backend')
const { verifyToken } = await import('../src/auth')

describe('verifyToken', () => {
  it('returns the Clerk user id for a valid token', async () => {
    vi.stubEnv('CLERK_SECRET_KEY', 'sk_test')
    vi.stubEnv('CLERK_JWT_KEY', 'pem')
    vi.mocked(verifyClerkToken).mockResolvedValue({ sub: 'user_1' } as never)
    await expect(verifyToken('tok')).resolves.toBe('user_1')
    expect(verifyClerkToken).toHaveBeenCalledWith('tok', { secretKey: 'sk_test', jwtKey: 'pem', authorizedParties: undefined })
  })

  it('only accepts tokens issued for the allowed app origins, when configured', async () => {
    vi.stubEnv('CLERK_SECRET_KEY', 'sk_test')
    vi.stubEnv('CLERK_AUTHORIZED_PARTIES', 'https://cutty.app, cutty://')
    vi.mocked(verifyClerkToken).mockResolvedValue({ sub: 'user_1' } as never)
    await verifyToken('tok')
    expect(verifyClerkToken).toHaveBeenCalledWith('tok', expect.objectContaining({ authorizedParties: ['https://cutty.app', 'cutty://'] }))
  })

  it('returns null for invalid tokens or a missing subject', async () => {
    vi.stubEnv('CLERK_SECRET_KEY', 'sk_test')
    vi.mocked(verifyClerkToken).mockRejectedValueOnce(new Error('expired'))
    await expect(verifyToken('tok')).resolves.toBeNull()
    vi.mocked(verifyClerkToken).mockResolvedValueOnce({ sub: '' } as never)
    await expect(verifyToken('tok')).resolves.toBeNull()
  })

  it('throws when the server is not configured', async () => {
    vi.stubEnv('CLERK_SECRET_KEY', '')
    await expect(verifyToken('tok')).rejects.toThrow('CLERK_SECRET_KEY is not set')
  })
})
