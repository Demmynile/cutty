import 'server-only'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

// RFC 6238 TOTP (30s step, 6 digits, SHA-1) — what Google Authenticator,
// 1Password, Authy etc. expect. Used as the mandatory second factor for admins.

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function generateTotpSecret(): string {
  const bytes = randomBytes(20)
  let bits = ''
  for (const b of bytes) bits += b.toString(2).padStart(8, '0')
  let out = ''
  for (let i = 0; i + 5 <= bits.length; i += 5) out += ALPHABET[parseInt(bits.slice(i, i + 5), 2)]
  return out
}

function base32Decode(secret: string): Buffer {
  let bits = ''
  for (const ch of secret.replace(/=+$/, '').toUpperCase()) {
    const v = ALPHABET.indexOf(ch)
    if (v === -1) continue
    bits += v.toString(2).padStart(5, '0')
  }
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2))
  return Buffer.from(bytes)
}

function codeAt(key: Buffer, counter: number): string {
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64BE(BigInt(counter))
  const hmac = createHmac('sha1', key).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const bin = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000
  return bin.toString().padStart(6, '0')
}

// Accepts the previous/current/next step to tolerate clock drift.
export function verifyTotp(secret: string, code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false
  const key = base32Decode(secret)
  const step = Math.floor(Date.now() / 1000 / 30)
  return [-1, 0, 1].some((d) => timingSafeEqual(Buffer.from(codeAt(key, step + d)), Buffer.from(code)))
}

export function totpUri(secret: string, email: string) {
  return `otpauth://totp/Cutty%20Admin:${encodeURIComponent(email)}?secret=${secret}&issuer=Cutty%20Admin`
}
