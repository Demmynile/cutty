import { vi } from 'vitest'

export const store = new Map<string, string>()
export const setItemAsync = vi.fn(async (k: string, v: string) => { store.set(k, v) })
export const getItemAsync = vi.fn(async (k: string) => store.get(k) ?? null)
export const deleteItemAsync = vi.fn(async (k: string) => { store.delete(k) })
