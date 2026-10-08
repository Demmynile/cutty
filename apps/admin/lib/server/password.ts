import 'server-only'
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number, opts: object) => Promise<Buffer>

// scrypt (memory-hard, per-user random salt). Stored as
// scrypt$N$r$p$<salt b64>$<hash b64> so parameters can be raised later.
const N = 2 ** 15
const R = 8
const P = 1
const KEYLEN = 64
const MAXMEM = 64 * 1024 * 1024

export const MIN_PASSWORD_LENGTH = 8

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await scrypt(password, salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM })
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`
}

// Accounts created by the old mobile-only flow hold an unsalted
// SHA-256("cutty-mobile-v1:<password>") hex digest. They still verify, and the
// caller re-hashes with scrypt on the next successful login (needsRehash).
const LEGACY_PEPPER = 'cutty-mobile-v1'

export async function verifyPassword(password: string, stored: string | undefined | null): Promise<boolean> {
  if (!stored) return false

  if (stored.startsWith('scrypt$')) {
    const [, n, r, p, saltB64, hashB64] = stored.split('$')
    const expected = Buffer.from(hashB64, 'base64')
    const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length, {
      N: Number(n), r: Number(r), p: Number(p), maxmem: MAXMEM,
    })
    return timingSafeEqual(actual, expected)
  }

  if (/^[0-9a-f]{64}$/.test(stored)) {
    const actual = createHash('sha256').update(`${LEGACY_PEPPER}:${password}`).digest()
    return timingSafeEqual(actual, Buffer.from(stored, 'hex'))
  }

  return false
}

export function needsRehash(stored: string): boolean {
  return !stored.startsWith(`scrypt$${N}$${R}$${P}$`)
}

// Burns comparable time when the account doesn't exist, so response timing
// doesn't reveal which emails are registered.
const DUMMY_HASH = hashPassword('dummy-password-for-timing')
export async function verifyDummy(password: string) {
  await verifyPassword(password, await DUMMY_HASH)
}

export function randomPassword(): string {
  return randomBytes(18).toString('base64url')
}
