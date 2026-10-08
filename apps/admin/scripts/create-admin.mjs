/**
 * Creates (or resets) an individual admin account for the dashboard.
 * Every admin gets their own login — never share accounts — and MFA is
 * mandatory: the printed authenticator secret must be added to an app like
 * Google Authenticator / 1Password before the first sign-in.
 *
 *   node --env-file=apps/admin/.env apps/admin/scripts/create-admin.mjs you@example.com "Your Name" owner
 *   node --env-file=apps/admin/.env apps/admin/scripts/create-admin.mjs staff@example.com "Staff Name" staff
 *   node --env-file=apps/admin/.env apps/admin/scripts/create-admin.mjs staff@example.com --deactivate
 *
 * Re-running for an existing email issues a new password + authenticator
 * secret and signs out all of that admin's sessions.
 */
import { createClient } from '@sanity/client'
import { randomBytes, scryptSync, randomUUID } from 'node:crypto'

const [email, nameOrFlag, role = 'staff'] = process.argv.slice(2)
if (!email || !nameOrFlag) {
  console.error('Usage: create-admin.mjs <email> "<name>" [owner|staff]   |   create-admin.mjs <email> --deactivate')
  process.exit(1)
}
if (!['owner', 'staff'].includes(role)) {
  console.error('role must be owner or staff')
  process.exit(1)
}

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  apiVersion: '2024-01-01',
  token: process.env.SANITY_API_TOKEN,
  useCdn: false,
})

const normalized = email.trim().toLowerCase()
const existing = await client.fetch(`*[_type == "adminUser" && lower(email) == $email][0]{ _id, sessionVersion }`, { email: normalized })

if (nameOrFlag === '--deactivate') {
  if (!existing) throw new Error(`No admin ${normalized}`)
  await client.patch(existing._id).set({ isActive: false, sessionVersion: (existing.sessionVersion ?? 0) + 1 }).commit()
  console.log(`Deactivated ${normalized} and revoked their sessions.`)
  process.exit(0)
}

// Must match lib/server/password.ts
const N = 2 ** 15, R = 8, P = 1
const password = randomBytes(18).toString('base64url')
const salt = randomBytes(16)
const hash = scryptSync(password, salt, 64, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 })
const passwordHash = `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`

// Must match lib/server/totp.ts
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
let bits = ''
for (const b of randomBytes(20)) bits += b.toString(2).padStart(8, '0')
let totpSecret = ''
for (let i = 0; i + 5 <= bits.length; i += 5) totpSecret += ALPHABET[parseInt(bits.slice(i, i + 5), 2)]

const fields = {
  email: normalized,
  name: nameOrFlag,
  role,
  passwordHash,
  totpSecret,
  isActive: true,
  sessionVersion: (existing?.sessionVersion ?? -1) + 1,
}

if (existing) await client.patch(existing._id).set(fields).commit()
else await client.create({ _id: randomUUID(), _type: 'adminUser', ...fields, createdAt: new Date().toISOString() })

await client.create({
  _type: 'auditLog',
  action: existing ? 'admin.credentials_reset' : 'admin.created',
  actorType: 'system',
  actorId: 'create-admin-script',
  targetType: 'adminUser',
  targetId: normalized,
  outcome: 'success',
  details: JSON.stringify({ role }),
  createdAt: new Date().toISOString(),
})

console.log(`
${existing ? 'Reset' : 'Created'} ${role} admin: ${normalized}

  Temporary password:   ${password}
  Authenticator secret: ${totpSecret}
  otpauth URI:          otpauth://totp/Cutty%20Admin:${encodeURIComponent(normalized)}?secret=${totpSecret}&issuer=Cutty%20Admin

Send the password and secret to the admin over separate private channels.
This is the only time they are shown.
`)
