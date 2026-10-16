import { beforeEach, describe, expect, it, vi } from 'vitest'
import { request } from '../../helpers/http'

const clerkApi = vi.hoisted(() => ({
  verifyToken: vi.fn(),
  getUser: vi.fn(),
  deleteUser: vi.fn(),
  createClerkClient: vi.fn(),
}))

vi.mock('@clerk/backend', () => ({
  verifyToken: clerkApi.verifyToken,
  createClerkClient: clerkApi.createClerkClient,
}))

const { clerk, clerkIdentity, deleteClerkUser, requireClerkUser } = await import('@/lib/server/clerk')

const withBearer = (t: string) => request('GET', '/', undefined, { authorization: `Bearer ${t}` })

beforeEach(() => {
  clerkApi.createClerkClient.mockReturnValue({ users: { getUser: clerkApi.getUser, deleteUser: clerkApi.deleteUser } })
})

describe('requireClerkUser', () => {
  it('returns the verified Clerk user id', async () => {
    clerkApi.verifyToken.mockResolvedValue({ sub: 'user_1' })
    await expect(requireClerkUser(withBearer('tok'))).resolves.toBe('user_1')
    expect(clerkApi.verifyToken).toHaveBeenCalledWith('tok', expect.objectContaining({ secretKey: 'sk_test_clerk' }))
  })

  it('401s without a bearer token', async () => {
    await expect(requireClerkUser(request('GET', '/'))).rejects.toMatchObject({ status: 401, message: 'Please sign in' })
    await expect(requireClerkUser(request('GET', '/', undefined, { authorization: 'Basic abc' }))).rejects.toMatchObject({ status: 401 })
  })

  it('401s for an invalid or subject-less token', async () => {
    clerkApi.verifyToken.mockRejectedValueOnce(new Error('bad sig'))
    await expect(requireClerkUser(withBearer('x'))).rejects.toMatchObject({ status: 401, message: expect.stringMatching(/expired/) })
    clerkApi.verifyToken.mockResolvedValueOnce({ sub: '' })
    await expect(requireClerkUser(withBearer('x'))).rejects.toMatchObject({ status: 401 })
  })

  it('treats a missing secret key as a server error, not a 401', async () => {
    vi.stubEnv('CLERK_SECRET_KEY', '')
    await expect(requireClerkUser(withBearer('x'))).rejects.toThrow('CLERK_SECRET_KEY is not set')
  })
})

describe('clerkIdentity', () => {
  it('returns the verified primary email (lower-cased) and full name', async () => {
    clerkApi.getUser.mockResolvedValue({
      primaryEmailAddressId: 'e2', firstName: 'Ada', lastName: 'Obi',
      emailAddresses: [
        { id: 'e1', emailAddress: 'other@x.com', verification: { status: 'verified' } },
        { id: 'e2', emailAddress: ' Ada@Cutty.App ', verification: { status: 'verified' } },
      ],
    })
    await expect(clerkIdentity('user_1')).resolves.toEqual({ clerkUserId: 'user_1', email: 'ada@cutty.app', fullName: 'Ada Obi' })
  })

  it('withholds an unverified email and returns null name when blank', async () => {
    clerkApi.getUser.mockResolvedValue({
      primaryEmailAddressId: 'e1', firstName: null, lastName: null,
      emailAddresses: [{ id: 'e1', emailAddress: 'a@b.c', verification: { status: 'unverified' } }],
    })
    await expect(clerkIdentity('user_1')).resolves.toEqual({ clerkUserId: 'user_1', email: null, fullName: null })
  })
})

describe('deleteClerkUser', () => {
  it('deletes the user', async () => {
    await deleteClerkUser('user_1')
    expect(clerkApi.deleteUser).toHaveBeenCalledWith('user_1')
  })

  it('ignores a user that is already gone', async () => {
    clerkApi.deleteUser.mockRejectedValue({ status: 404 })
    await expect(deleteClerkUser('user_1')).resolves.toBeUndefined()
  })

  it('rethrows other failures', async () => {
    clerkApi.deleteUser.mockRejectedValue({ status: 500 })
    await expect(deleteClerkUser('user_1')).rejects.toEqual({ status: 500 })
  })
})

describe('clerk()', () => {
  it('creates the client once and reuses it', () => {
    expect(clerk()).toBe(clerk())
  })
})
