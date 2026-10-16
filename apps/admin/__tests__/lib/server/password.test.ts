import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  MIN_PASSWORD_LENGTH, hashPassword, needsRehash, randomPassword, verifyDummy, verifyPassword,
} from '@/lib/server/password'

describe('password hashing', () => {
  it('hashes with scrypt and a random salt', async () => {
    const a = await hashPassword('correct horse')
    const b = await hashPassword('correct horse')
    expect(a).toMatch(/^scrypt\$32768\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/)
    expect(a).not.toBe(b)
  })

  it('verifies the right password and rejects the wrong one', async () => {
    const stored = await hashPassword('correct horse')
    expect(await verifyPassword('correct horse', stored)).toBe(true)
    expect(await verifyPassword('wrong horse', stored)).toBe(false)
  })

  it('verifies legacy SHA-256 hashes from the old mobile flow', async () => {
    const legacy = createHash('sha256').update('cutty-mobile-v1:hunter22').digest('hex')
    expect(await verifyPassword('hunter22', legacy)).toBe(true)
    expect(await verifyPassword('hunter23', legacy)).toBe(false)
  })

  it('rejects empty and unrecognised stored values', async () => {
    expect(await verifyPassword('x', undefined)).toBe(false)
    expect(await verifyPassword('x', null)).toBe(false)
    expect(await verifyPassword('x', '')).toBe(false)
    expect(await verifyPassword('x', 'bcrypt$whatever')).toBe(false)
  })

  it('flags legacy and weaker-parameter hashes for rehash', async () => {
    expect(needsRehash(await hashPassword('pw'))).toBe(false)
    expect(needsRehash('a'.repeat(64))).toBe(true)
    expect(needsRehash('scrypt$16384$8$1$salt$hash')).toBe(true)
  })

  it('verifyDummy completes without throwing', async () => {
    await expect(verifyDummy('anything')).resolves.toBeUndefined()
  })

  it('randomPassword is long, url-safe and unique', () => {
    const a = randomPassword()
    expect(a).toMatch(/^[A-Za-z0-9_-]{24}$/)
    expect(a.length).toBeGreaterThanOrEqual(MIN_PASSWORD_LENGTH)
    expect(randomPassword()).not.toBe(a)
  })
})
