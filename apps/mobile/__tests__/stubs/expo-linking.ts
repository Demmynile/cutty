import { vi } from 'vitest'

export const createURL = vi.fn((path: string) => `cutty://${path}`)
