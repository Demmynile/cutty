import { vi } from 'vitest'

// expo-status-bar, expo-splash-screen, expo-sharing, expo-file-system/legacy, expo-crypto
export const StatusBar = () => null
export const preventAutoHideAsync = vi.fn(async () => true)
export const hideAsync = vi.fn(async () => true)
export const shareAsync = vi.fn(async () => undefined)
export const isAvailableAsync = vi.fn(async () => true)
export const cacheDirectory = 'file:///cache/'
export const writeAsStringAsync = vi.fn(async () => undefined)
export const EncodingType = { Base64: 'base64' }
export const randomUUID = vi.fn(() => '00000000-0000-4000-8000-000000000000')
export const tokenCache = { getToken: vi.fn(), saveToken: vi.fn() }
