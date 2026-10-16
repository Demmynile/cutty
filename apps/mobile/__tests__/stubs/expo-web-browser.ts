import { vi } from 'vitest'

export const openAuthSessionAsync = vi.fn(async () => ({ type: 'success' }))
