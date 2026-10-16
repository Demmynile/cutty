import { beforeEach, vi } from 'vitest'

// Fixed, obviously-fake configuration so modules that read env at import time
// load the same way in every run. Nothing here talks to a real service.
process.env.AUTH_JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long'
process.env.PAYSTACK_SECRET_KEY = 'sk_test_paystack'
process.env.CLERK_SECRET_KEY = 'sk_test_clerk'
process.env.NEXT_PUBLIC_SANITY_PROJECT_ID = 'testproj'
process.env.NEXT_PUBLIC_SANITY_DATASET = 'test'
process.env.SHOP_TIMEZONE = 'Africa/Lagos'

beforeEach(() => {
  // Route handlers log unexpected errors on purpose; keep test output readable.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
