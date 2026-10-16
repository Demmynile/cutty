import { vi } from 'vitest'

export const requestCameraPermissionsAsync = vi.fn(async () => ({ status: 'granted' }))
export const requestMediaLibraryPermissionsAsync = vi.fn(async () => ({ status: 'granted' }))
export const launchCameraAsync = vi.fn(async () => ({ canceled: false, assets: [{ uri: 'file:///camera.jpg' }] }))
export const launchImageLibraryAsync = vi.fn(async () => ({ canceled: false, assets: [{ uri: 'file:///library.jpg' }] }))
