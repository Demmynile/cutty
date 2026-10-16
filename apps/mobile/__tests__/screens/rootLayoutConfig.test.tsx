// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/realtime', () => ({ disconnectRealtime: vi.fn() }))

// Own file: the import must fail at module load, which would poison the
// module graph for other tests.
describe('app/_layout configuration', () => {
  it('refuses to start without a Clerk publishable key', async () => {
    vi.stubEnv('EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY', '')
    await expect(import('@/app/_layout')).rejects.toThrow(/EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set/)
  })
})
