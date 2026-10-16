import { vi } from 'vitest'

export const SaveFormat = { JPEG: 'jpeg', PNG: 'png' } as const

export const saveAsync = vi.fn(async (_opts: unknown) => ({ uri: 'file:///prepared.jpg', base64: 'cHJlcGFyZWQ=' as string | undefined }))
export const resize = vi.fn((_size: unknown) => ({ renderAsync: async () => ({ saveAsync }) }))
export const ImageManipulator = { manipulate: vi.fn((_uri: string) => ({ resize })) }
