import { createHmac } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateTotpSecret, totpUri, verifyTotp } from '@/lib/server/totp'

// RFC 6238 appendix B test secret ("12345678901234567890" in base32).
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'

function codeFor(secretAscii: string, unixSeconds: number) {
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64BE(BigInt(Math.floor(unixSeconds / 30)))
  const h = createHmac('sha1', Buffer.from(secretAscii)).update(buf).digest()
  const o = h[h.length - 1] & 0x0f
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0')
}

afterEach(() => {
  vi.useRealTimers()
})

describe('TOTP', () => {
  it('generates a 32-character base32 secret', () => {
    const s = generateTotpSecret()
    expect(s).toMatch(/^[A-Z2-7]{32}$/)
    expect(generateTotpSecret()).not.toBe(s)
  })

  it('matches the RFC 6238 SHA-1 vector at T=59s (287082)', () => {
    vi.useFakeTimers({ now: 59_000 })
    expect(verifyTotp(RFC_SECRET, '287082')).toBe(true)
  })

  it('accepts the previous and next step to tolerate clock drift, not further', () => {
    const t = 1_700_000_000
    vi.useFakeTimers({ now: t * 1000 })
    const secret = '12345678901234567890'
    expect(verifyTotp(RFC_SECRET, codeFor(secret, t - 30))).toBe(true)
    expect(verifyTotp(RFC_SECRET, codeFor(secret, t + 30))).toBe(true)
    expect(verifyTotp(RFC_SECRET, codeFor(secret, t - 90))).toBe(false)
  })

  it('rejects malformed codes', () => {
    expect(verifyTotp(RFC_SECRET, '12345')).toBe(false)
    expect(verifyTotp(RFC_SECRET, 'abcdef')).toBe(false)
    expect(verifyTotp(RFC_SECRET, '1234567')).toBe(false)
  })

  it('ignores padding, lowercase and invalid characters in the secret', () => {
    vi.useFakeTimers({ now: 59_000 })
    expect(verifyTotp(`${RFC_SECRET.toLowerCase()}====`, '287082')).toBe(true)
  })

  it('builds an otpauth URI with the email encoded', () => {
    expect(totpUri('ABC', 'a+b@cutty.app')).toBe('otpauth://totp/Cutty%20Admin:a%2Bb%40cutty.app?secret=ABC&issuer=Cutty%20Admin')
  })
})
