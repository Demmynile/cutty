import { vi } from 'vitest'

export const vars = (o: Record<string, string>) => ({ __vars: o })
export const cssInterop = vi.fn()
