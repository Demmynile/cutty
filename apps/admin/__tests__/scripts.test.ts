import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { TRY_ON_STYLES } from '@cutty/types'
import { hashPassword } from '@/lib/server/password'
import { generateTotpSecret } from '@/lib/server/totp'
import nextConfig from '@/next.config'
import tailwindConfig from '@/tailwind.config'
import postcssConfig from '@/postcss.config.mjs'

// The scripts in apps/admin/scripts are plain .mjs CLIs that call Sanity or
// the AI Gateway, so they aren't run here. Instead these tests pin the parts
// that their comments say "must match" the TypeScript source.

const read = (rel: string) => fs.readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
const scriptPath = (name: string) => fileURLToPath(new URL(`../scripts/${name}`, import.meta.url))

describe('scripts/create-admin.mjs', () => {
  const src = read('../scripts/create-admin.mjs')

  it('writes password hashes in the format lib/server/password.ts verifies', async () => {
    const [n, r, p] = src.match(/const N = 2 \*\* (\d+), R = (\d+), P = (\d+)/)!.slice(1).map(Number)
    const serverPrefix = (await hashPassword('x')).split('$').slice(0, 4).join('$')
    expect(`scrypt$${2 ** n}$${r}$${p}`).toBe(serverPrefix)
    expect(src).toContain('scryptSync(password, salt, 64,')
  })

  it('generates TOTP secrets with the same alphabet and length as lib/server/totp.ts', () => {
    expect(src).toContain("const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'")
    expect(src).toContain('randomBytes(20)')
    expect(generateTotpSecret()).toHaveLength(32)
  })

  it.each([
    [[], /Usage/],
    [['a@b.c', 'Name', 'superuser'], /role must be owner or staff/],
  ])('exits 1 with %j before touching Sanity', (args, message) => {
    const res = spawnSync(process.execPath, [scriptPath('create-admin.mjs'), ...args], { encoding: 'utf8', env: { PATH: process.env.PATH ?? '', NODE_ENV: 'test' } })
    expect(res.status).toBe(1)
    expect(res.stderr).toMatch(message)
  })
})

describe('scripts/generate-style-photos.mjs', () => {
  it('lists exactly the try-on presets, with the same genders', () => {
    const src = read('../scripts/generate-style-photos.mjs')
    const scriptStyles = [...src.matchAll(/\{ id: '([^']+)', gender: '(male|female|unisex)'/g)].map(([, id, gender]) => ({ id, gender }))
    expect(scriptStyles).toEqual(TRY_ON_STYLES.map(({ id, gender }) => ({ id, gender })))
  })
})

describe('scripts/generate-onboarding-art.mjs', () => {
  it('writes into the folder the onboarding screen loads from', () => {
    expect(read('../scripts/generate-onboarding-art.mjs')).toContain("'../../mobile/assets/onboarding/'")
    const screen = read('../../mobile/app/onboarding.tsx')
    for (const [, file] of screen.matchAll(/require\('\.\.\/assets\/onboarding\/([^']+)'\)/g)) {
      expect(fs.existsSync(fileURLToPath(new URL(`../../mobile/assets/onboarding/${file}`, import.meta.url)))).toBe(true)
    }
  })
})

describe('scripts parse as valid ES modules', () => {
  it.each(['create-admin.mjs', 'generate-onboarding-art.mjs', 'generate-style-photos.mjs', 'probe2.mjs'])('%s', (name) => {
    expect(() => execFileSync(process.execPath, ['--check', scriptPath(name)])).not.toThrow()
  })
})

describe('next.config.ts', () => {
  it('hides the X-Powered-By header and only loads images from the Sanity CDN', () => {
    expect(nextConfig.poweredByHeader).toBe(false)
    expect(nextConfig.images?.remotePatterns).toEqual([{ protocol: 'https', hostname: 'cdn.sanity.io' }])
  })

  it('sends strict security headers on every path', async () => {
    const [rule] = await nextConfig.headers!()
    expect(rule.source).toBe('/:path*')
    const h = Object.fromEntries(rule.headers.map(({ key, value }) => [key, value]))
    expect(h['X-Frame-Options']).toBe('DENY')
    expect(h['X-Content-Type-Options']).toBe('nosniff')
    expect(h['Strict-Transport-Security']).toMatch(/max-age=\d{8,}; includeSubDomains/)
    expect(h['Content-Security-Policy']).toContain("frame-ancestors 'none'")
    expect(h['Content-Security-Policy']).toContain("img-src 'self' data: https://cdn.sanity.io")
    expect(h['Content-Security-Policy']).not.toContain('unsafe-eval') // only added in development
  })
})

describe('tailwind.config.ts and postcss.config.mjs', () => {
  it('scans app and components, and shares the brand scale with the mobile app', () => {
    expect(tailwindConfig.content).toEqual(['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'])
    const primary = (tailwindConfig.theme?.extend?.colors as Record<string, Record<string, string>>).primary
    const mobile = read('../../mobile/tailwind.config.js')
    for (const [shade, hex] of Object.entries(primary)) {
      if (shade === '400') continue // themed in the app; checked against lib/theme.ts in the mobile tests
      expect(mobile, `primary-${shade}`).toContain(`${shade}: '${hex}'`)
    }
    expect(read('../../mobile/lib/theme.ts')).toContain(`'primary-400': '${primary[400].toUpperCase()}'`)
  })

  it('runs tailwind then autoprefixer', () => {
    expect(Object.keys(postcssConfig.plugins)).toEqual(['tailwindcss', 'autoprefixer'])
  })
})
