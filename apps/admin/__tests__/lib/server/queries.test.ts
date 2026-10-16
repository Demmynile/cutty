import { describe, expect, it } from 'vitest'
import * as queries from '@/lib/server/queries'
import * as proQueries from '@/lib/server/proQueries'

// The GROQ strings are the access-control boundary for the API: these checks
// pin the properties that keep one user's data away from another.

const all = { ...queries, ...proQueries }

function balanced(q: string) {
  const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' }
  const stack: string[] = []
  for (const ch of q.replace(/"[^"]*"/g, '')) {
    if ('([{'.includes(ch)) stack.push(ch)
    else if (ch in pairs && stack.pop() !== pairs[ch]) return false
  }
  return stack.length === 0
}

describe('GROQ queries', () => {
  it.each(Object.entries(all))('%s has balanced brackets', (_name, q) => {
    expect(balanced(q)).toBe(true)
  })

  it('scopes every customer query to $customerId', () => {
    for (const name of ['CUSTOMER_BY_ID', 'BOOKINGS_BY_CUSTOMER', 'ORDERS_BY_CUSTOMER', 'LOYALTY_TRANSACTIONS_BY_CUSTOMER', 'WALLET_TRANSACTIONS_BY_CUSTOMER', 'BOOKING_BY_ID_FOR_CUSTOMER'] as const) {
      expect(queries[name]).toContain('$customerId')
    }
    expect(queries.BOOKING_BY_ID_FOR_CUSTOMER).toContain('customer._ref == $customerId')
  })

  it('never exposes password hashes or secrets to customers', () => {
    expect(queries.CUSTOMER_PUBLIC_FIELDS).not.toMatch(/password|clerkUserId/)
    expect(queries.CUSTOMER_BY_ID).not.toMatch(/password/)
  })

  it('only ADMIN_BY_EMAIL reads the admin password hash and TOTP secret', () => {
    expect(queries.ADMIN_BY_EMAIL).toMatch(/passwordHash[\s\S]*totpSecret/)
    expect(queries.ADMIN_SESSION_BY_ID).not.toMatch(/passwordHash|totpSecret/)
  })

  it('hides products from suspended stylist shops', () => {
    for (const q of [queries.PRODUCTS_ACTIVE, queries.PRODUCTS_FEATURED, queries.PRODUCT_BY_SLUG, queries.PRODUCTS_BY_IDS]) {
      expect(q).toContain('seller->shop.status == "approved"')
      expect(q).toContain('isActive == true')
    }
  })

  it('books only approved, active stylists who have set a price', () => {
    expect(queries.BOOKABLE_STYLIST_BY_BARBER_ID).toContain('status == "approved"')
    expect(queries.BOOKABLE_STYLIST_BY_BARBER_ID).toContain('isActive != false')
    expect(queries.BOOKABLE_STYLIST_BY_BARBER_ID).toContain('defined(bookingPrice)')
    expect(queries.BOOKABLE_STYLIST_BY_BARBER_ID).toContain('barber->isAvailable == true')
  })

  it('scopes stylist catalogue queries to $stylistId', () => {
    for (const q of [proQueries.PRO_PRODUCTS, proQueries.PRO_PRODUCT_BY_ID, proQueries.PRO_SALES, proQueries.PRO_SALE_BY_ID, proQueries.CONVERSATIONS_FOR_STYLIST]) {
      expect(q).toContain('$stylistId')
    }
  })

  it('shows only approved, active stylists publicly and never their bank details', () => {
    for (const q of [proQueries.STYLISTS_PUBLIC, proQueries.STYLIST_PUBLIC_BY_ID]) {
      expect(q).toContain('status == "approved"')
      expect(q).toContain('isActive != false')
      expect(q).not.toMatch(/accountNumber|subaccountCode|email|phone/)
    }
  })

  it('conversation lists show each side its own unread count', () => {
    expect(proQueries.CONVERSATIONS_FOR_CUSTOMER).toContain('customerUnread')
    expect(proQueries.CONVERSATIONS_FOR_STYLIST).toContain('stylistUnread')
  })
})
