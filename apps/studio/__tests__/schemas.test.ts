import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { schemaTypes } from '../schemas'
import { adminUser } from '../schemas/adminUser'
import { aiSearch } from '../schemas/aiSearch'
import { auditLog } from '../schemas/auditLog'
import { barber } from '../schemas/barber'
import { booking } from '../schemas/booking'
import { category } from '../schemas/category'
import { chatMessage, conversation } from '../schemas/conversation'
import { customer } from '../schemas/customer'
import { discountCode } from '../schemas/discountCode'
import { loyaltyTransaction } from '../schemas/loyaltyTransaction'
import { order } from '../schemas/order'
import { product } from '../schemas/product'
import { settings } from '../schemas/settings'
import { stylist } from '../schemas/stylist'
import { walletTransaction } from '../schemas/walletTransaction'

type Field = {
  name: string; type: string; hidden?: boolean; readOnly?: boolean; initialValue?: unknown
  to?: Array<{ type: string }>; of?: Field[]; fields?: Field[]
  options?: { list?: unknown[] }
  validation?: (r: unknown) => unknown
  preview?: { select?: object; prepare?: (v: Record<string, unknown>) => unknown }
}
type Doc = Field & { title: string; readOnly?: boolean }

const docs = schemaTypes as unknown as Doc[]
const byName = Object.fromEntries(docs.map((d) => [d.name, d]))
const field = (doc: Doc, name: string) => {
  const f = doc.fields?.find((x) => x.name === name)
  if (!f) throw new Error(`${doc.name}.${name} missing`)
  return f
}

/** Every nested field definition, with a dotted path. */
function walk(fields: Field[] = [], prefix = ''): Array<[string, Field]> {
  return fields.flatMap((f) => {
    const p = `${prefix}${f.name ?? `[${f.type}]`}`
    return [[p, f] as [string, Field], ...walk(f.fields, `${p}.`), ...walk(f.of, `${p}[].`)]
  })
}

// Records the rule chain a validation function builds, e.g. ['min:0', 'max:5'].
function rules(validation: Field['validation']) {
  const calls: string[] = []
  const rule: Record<string, (...a: unknown[]) => unknown> = new Proxy({}, {
    get: (_t, prop: string) => (...args: unknown[]) => {
      calls.push(args.length ? `${prop}:${args.join(',')}` : prop)
      return rule
    },
  })
  validation?.(rule)
  return calls
}

describe('schema registry', () => {
  it('registers every schema file once, with unique names', () => {
    const names = docs.map((d) => d.name)
    expect(new Set(names).size).toBe(names.length)
    expect(names.sort()).toEqual([
      'aiSearch', 'adminUser', 'auditLog', 'barber', 'booking', 'category', 'chatMessage', 'conversation', 'customer',
      'discountCode', 'loyaltyTransaction', 'order', 'product', 'settings', 'stylist', 'walletTransaction',
    ].sort())
    for (const d of [adminUser, aiSearch, auditLog, barber, booking, category, chatMessage, conversation, customer, discountCode, loyaltyTransaction, order, product, settings, stylist, walletTransaction]) {
      expect(schemaTypes).toContain(d)
    }
  })

  it('every type is a document with a title and named fields', () => {
    for (const d of docs) {
      expect(d.type, d.name).toBe('document')
      expect(d.title, d.name).toBeTruthy()
      for (const [p, f] of walk(d.fields)) expect(f.type, `${d.name}.${p}`).toBeTruthy()
    }
  })

  it('every reference points at a registered type', () => {
    for (const d of docs) {
      for (const [p, f] of walk(d.fields)) {
        for (const target of f.to ?? []) expect(byName[target.type], `${d.name}.${p} → ${target.type}`).toBeDefined()
      }
    }
  })

  it('has no duplicate field names within an object', () => {
    const check = (fields: Field[] = [], where: string) => {
      const names = fields.map((f) => f.name).filter(Boolean)
      expect(new Set(names).size, where).toBe(names.length)
      for (const f of fields) {
        check(f.fields, `${where}.${f.name}`)
        for (const m of f.of ?? []) check(m.fields, `${where}.${f.name}[]`)
      }
    }
    for (const d of docs) check(d.fields, d.name)
  })

  it('defines every document type the API and realtime server query', () => {
    const root = path.resolve(__dirname, '../..')
    const sources = [
      'admin/lib/server', 'admin/app/api', 'admin/app/(dashboard)', 'admin/app/(auth)', 'realtime/src',
    ].flatMap((dir) => listFiles(path.join(root, dir)))
    const used = new Set<string>()
    for (const file of sources) {
      for (const [, t] of fs.readFileSync(file, 'utf8').matchAll(/_type\s*(?:==|:)\s*['"]([a-zA-Z]+)['"]/g)) used.add(t)
    }
    expect(used.size).toBeGreaterThan(10)
    for (const t of used) {
      if (t === 'reference' || t === 'image' || t === 'block' || t === 'span' || t === 'slug') continue
      expect(byName[t], `_type "${t}" used in code`).toBeDefined()
    }
  })
})

function listFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    return e.isDirectory() ? listFiles(p) : /\.(ts|tsx)$/.test(e.name) ? [p] : []
  })
}

describe('secrets are hidden and read-only in Studio', () => {
  it.each([
    [adminUser, 'passwordHash'], [adminUser, 'totpSecret'], [adminUser, 'sessionVersion'],
    [customer, 'password'], [customer, 'sessionVersion'],
    [stylist, 'password'], [stylist, 'sessionVersion'],
  ] as const)('%s.%s', (doc, name) => {
    expect(field(doc as unknown as Doc, name)).toMatchObject({ hidden: true, readOnly: true })
  })

  it('admin accounts are managed only by the create-admin script', () => {
    for (const f of (adminUser as unknown as Doc).fields!) expect(f.readOnly, f.name).toBe(true)
  })

  it('identity links and server-managed state cannot be edited by hand', () => {
    expect(field(customer as unknown as Doc, 'clerkUserId').readOnly).toBe(true)
    expect(field(stylist as unknown as Doc, 'clerkUserId').readOnly).toBe(true)
    expect(field(stylist as unknown as Doc, 'shop').readOnly).toBe(true)
    expect(field(stylist as unknown as Doc, 'barber').readOnly).toBe(true)
    for (const d of [auditLog, aiSearch, conversation, chatMessage]) expect((d as unknown as Doc).readOnly, (d as unknown as Doc).name).toBe(true)
  })
})

describe('validation rules', () => {
  it.each([
    [barber, 'rating', ['min:0', 'max:5']],
    [booking, 'rating', ['min:1', 'max:5']],
    [stylist, 'bookingDuration', ['min:15', 'max:720']],
    [customer, 'email', ['required', 'email']],
    [stylist, 'yearsExperience', ['min:0', 'max:70']],
    [discountCode, 'value', ['required', 'min:0']],
    [chatMessage, 'text', ['required', 'max:4000']],
  ] as const)('%s.%s → %j', (doc, name, expected) => {
    expect(rules(field(doc as unknown as Doc, name).validation)).toEqual(expected)
  })

  it('saved cards hold only the last 4 digits', () => {
    const card = walk(field(customer as unknown as Doc, 'paymentMethods').of).find(([p]) => p.endsWith('last4'))![1]
    expect(rules(card.validation)).toEqual(['length:4'])
    const names = walk(field(customer as unknown as Doc, 'paymentMethods').of).map(([p]) => p)
    expect(names.some((n) => /number|cvv|pan/i.test(n))).toBe(false)
  })

  it('caps marketplace commission at 50% and the away assistant notes at 2000 chars', () => {
    const marketplace = field(settings as unknown as Doc, 'marketplace')
    const commission = marketplace.fields!.find((f) => f.name === 'commissionPercent')!
    expect(commission.initialValue).toBe(10)
    expect(rules(commission.validation)).toEqual(['min:0', 'max:50'])
    const notes = field(stylist as unknown as Doc, 'awayAssistant').fields!.find((f) => f.name === 'notes')!
    expect(rules(notes.validation)).toEqual(['max:2000'])
  })
})

describe('status lists match the app', () => {
  it.each([
    [booking, 'status', ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']],
    [booking, 'paymentMethod', ['wallet', 'card', 'cash', 'transfer']],
    [discountCode, 'applicableTo', ['booking', 'order', 'both']],
    [chatMessage, 'senderType', ['customer', 'stylist', 'ai']],
  ] as const)('%s.%s', (doc, name, list) => {
    expect(field(doc as unknown as Doc, name).options?.list).toEqual(list)
  })
})

describe('previews', () => {
  const prepare = (doc: unknown) => (doc as Doc).preview!.prepare!

  it('booking', () => {
    expect(prepare(booking)({ title: 'Ada', subtitle: '2026-06-01', status: 'pending' })).toEqual({ title: 'Ada', subtitle: '2026-06-01 — pending' })
    expect(prepare(booking)({ subtitle: 'd', status: 's' })).toMatchObject({ title: 'Unknown Customer' })
  })

  it('discount code', () => {
    expect(prepare(discountCode)({ title: 'TEN', subtitle: 'percentage', value: 10 })).toEqual({ title: 'TEN', subtitle: '10% off' })
    expect(prepare(discountCode)({ title: 'FIX', subtitle: 'fixed', value: 250_000 })).toEqual({ title: 'FIX', subtitle: `₦${(2500).toLocaleString()} off` })
  })

  it('loyalty and wallet transactions show signed amounts', () => {
    expect(prepare(loyaltyTransaction)({ title: 'Ada', subtitle: 'earn', points: 50 })).toEqual({ title: 'Ada', subtitle: 'earn — +50 pts' })
    expect(prepare(loyaltyTransaction)({ title: 'Ada', subtitle: 'redeem', points: -500 })).toEqual({ title: 'Ada', subtitle: 'redeem — -500 pts' })
    expect(prepare(walletTransaction)({ title: 'Ada', subtitle: 'topup', amount: 500_000, type: 'credit' })).toEqual({ title: 'Ada', subtitle: `topup +₦${(5000).toLocaleString()}` })
    expect(prepare(walletTransaction)({ title: 'Ada', subtitle: 'withdrawal', amount: 100, type: 'debit' })).toEqual({ title: 'Ada', subtitle: 'withdrawal -₦1' })
  })

  it('product and order', () => {
    expect(prepare(product)({ title: 'Gel', subtitle: 250_000, media: 'img' })).toEqual({ title: 'Gel', subtitle: `₦${(2500).toLocaleString()}`, media: 'img' })
    expect(prepare(product)({ title: 'Gel' })).toMatchObject({ subtitle: '' })
    expect(prepare(order)({ title: 'CUT-1', subtitle: 'Ada', status: 'paid' })).toEqual({ title: 'Order #CUT-1', subtitle: 'Ada — paid' })
  })

  it('conversation and saved cards', () => {
    expect(prepare(conversation)({ customer: 'Ada', stylist: 'Tunde', subtitle: 'hi' })).toEqual({ title: 'Ada ↔ Tunde', subtitle: 'hi' })
    expect(prepare(conversation)({})).toEqual({ title: 'Customer ↔ Stylist', subtitle: undefined })
    const card = field(customer as unknown as Doc, 'paymentMethods').of![0]
    expect(card.preview!.prepare!({ brand: 'visa', last4: '4242' })).toEqual({ title: 'VISA •••• 4242' })
    expect(card.preview!.prepare!({})).toEqual({ title: 'Card •••• ----' })
  })

  it('stylist availability windows', () => {
    const window = field(stylist as unknown as Doc, 'weeklyAvailability').of![0]
    expect(window.preview!.prepare!({ day: 'monday', start: '09:00', end: '17:00' })).toEqual({ title: 'monday 09:00–17:00' })
    expect(window.preview!.prepare!({})).toEqual({ title: '? –' })
  })
})
