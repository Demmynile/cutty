import { vi } from 'vitest'

// Location permission not yet granted: screens fall back to the default centre.
export const Accuracy = { Balanced: 3, High: 4 }
export const getForegroundPermissionsAsync = vi.fn(async () => ({ status: 'undetermined' }))
export const requestForegroundPermissionsAsync = vi.fn(async () => ({ status: 'denied' }))
export const getLastKnownPositionAsync = vi.fn(async () => null)
export const getCurrentPositionAsync = vi.fn(async () => ({ coords: { latitude: 6.45, longitude: 3.39 } }))
export const reverseGeocodeAsync = vi.fn(async () => [])
export const geocodeAsync = vi.fn(async () => [])
