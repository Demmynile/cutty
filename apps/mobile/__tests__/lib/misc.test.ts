import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TRY_ON_STYLES } from '@cutty/types'
import Constants from '../stubs/expo-constants'
import { saveAsync } from '../stubs/expo-image-manipulator'

vi.mock('@/lib/api', async (orig) => ({ ...(await orig<typeof import('@/lib/api')>()), api: vi.fn() }))

const { api } = await import('@/lib/api')
const { resolveDevUrl } = await import('@/lib/devHost')
const { aiSearch, analyzePhoto, sendChatMessage, tryOnStyle } = await import('@/lib/ai')
const { uploadProImage } = await import('@/lib/uploads')
const { payWithPaystack } = await import('@/lib/payments')
const { captureFromCamera, pickFromLibrary } = await import('@/lib/imagePrep')
const ImagePicker = await import('expo-image-picker')
const WebBrowser = await import('expo-web-browser')
const { formatPrice, urlFor } = await import('@/lib/sanity')
const { STYLE_IMAGES, UNISEX_STYLE_IMAGES, getStyleImage } = await import('@/lib/styleImages')
const constants = await import('@/constants')

describe('resolveDevUrl', () => {
  beforeEach(() => {
    Constants.expoConfig = { hostUri: '192.168.1.50:8081' }
  })

  it.each([
    ['http://localhost:3002', 'http://192.168.1.50:3002'],
    ['http://127.0.0.1:4000', 'http://192.168.1.50:4000'],
    ['http://10.0.0.5:3002', 'http://192.168.1.50:3002'],
    ['http://172.20.1.1', 'http://192.168.1.50'],
    ['http://192.168.0.9:3002', 'http://192.168.1.50:3002'],
  ])('swaps the private host in %s for the Metro host', (url, expected) => {
    expect(resolveDevUrl(url)).toBe(expected)
  })

  it('leaves public, missing and malformed URLs alone', () => {
    expect(resolveDevUrl('https://api.cutty.app')).toBe('https://api.cutty.app')
    expect(resolveDevUrl('http://172.32.0.1')).toBe('http://172.32.0.1')
    expect(resolveDevUrl(undefined)).toBeUndefined()
    expect(resolveDevUrl('not a url')).toBe('not a url')
  })

  it('leaves URLs alone when Expo has no host', () => {
    Constants.expoConfig = null
    expect(resolveDevUrl('http://localhost:3002')).toBe('http://localhost:3002')
  })
})

describe('AI client', () => {
  it.each([
    ['sendChatMessage', () => sendChatMessage({ mode: 'styling', messages: [] }), '/api/ai/chat'],
    ['analyzePhoto', () => analyzePhoto({ image: { base64: 'x', mediaType: 'image/jpeg' } }), '/api/ai/analyze'],
    ['tryOnStyle', () => tryOnStyle({ image: { base64: 'x', mediaType: 'image/jpeg' }, styleId: 'buzz' }), '/api/ai/tryon'],
    ['aiSearch', () => aiSearch('braids'), '/api/ai/search'],
  ])('%s POSTs to %s with a 70s timeout', async (_n, call, path) => {
    await call()
    expect(api).toHaveBeenCalledWith('POST', path, expect.anything(), 70_000)
  })
})

describe('uploadProImage', () => {
  it('uploads the prepared image and returns the asset id', async () => {
    vi.mocked(api).mockResolvedValue({ assetId: 'image-1' })
    await expect(uploadProImage({ uri: 'file:///x', base64: 'b64', mediaType: 'image/jpeg' }, 'product')).resolves.toBe('image-1')
    expect(api).toHaveBeenCalledWith('POST', '/api/v1/pro/uploads', { base64: 'b64', mediaType: 'image/jpeg', purpose: 'product' }, 60_000)
  })
})

describe('payWithPaystack', () => {
  it('opens checkout, then asks the server to verify', async () => {
    vi.mocked(api).mockResolvedValue({ status: 'completed' })
    await expect(payWithPaystack('https://checkout/x', 'ref1')).resolves.toBe('completed')
    expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith('https://checkout/x', 'cutty://payment-complete')
    expect(api).toHaveBeenCalledWith('POST', '/api/v1/payments/verify', { reference: 'ref1' })
  })

  it('polls up to three times while pending', async () => {
    vi.useFakeTimers()
    vi.mocked(api).mockResolvedValueOnce({ status: 'pending' }).mockResolvedValueOnce({ status: 'failed' })
    const result = payWithPaystack('u', 'r')
    await vi.advanceTimersByTimeAsync(2000)
    await expect(result).resolves.toBe('failed')

    vi.mocked(api).mockResolvedValue({ status: 'pending' })
    const stillPending = payWithPaystack('u', 'r')
    await vi.advanceTimersByTimeAsync(6000)
    await expect(stillPending).resolves.toBe('pending')
    expect(api).toHaveBeenCalledTimes(5)
    vi.useRealTimers()
  })
})

describe('imagePrep', () => {
  it('captures, resizes to 1024px and returns base64 JPEG', async () => {
    await expect(captureFromCamera()).resolves.toEqual({ uri: 'file:///prepared.jpg', base64: 'cHJlcGFyZWQ=', mediaType: 'image/jpeg' })
    expect(saveAsync).toHaveBeenCalledWith({ compress: 0.7, format: 'jpeg', base64: true })
    await expect(pickFromLibrary()).resolves.toMatchObject({ mediaType: 'image/jpeg' })
  })

  it('returns null when the user cancels', async () => {
    vi.mocked(ImagePicker.launchCameraAsync).mockResolvedValueOnce({ canceled: true, assets: [] } as never)
    await expect(captureFromCamera()).resolves.toBeNull()
    vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValueOnce({ canceled: false, assets: [] } as never)
    await expect(pickFromLibrary()).resolves.toBeNull()
  })

  it('throws when permission is denied or encoding fails', async () => {
    vi.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValueOnce({ status: 'denied' } as never)
    await expect(captureFromCamera()).rejects.toThrow('Camera permission was denied')
    vi.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValueOnce({ status: 'denied' } as never)
    await expect(pickFromLibrary()).rejects.toThrow('Photo library permission was denied')
    saveAsync.mockResolvedValueOnce({ uri: 'x', base64: undefined })
    await expect(captureFromCamera()).rejects.toThrow('Failed to prepare image')
  })
})

describe('lib/sanity', () => {
  it('builds image URLs and formats naira', () => {
    expect(urlFor({ _type: 'image', asset: { _type: 'reference', _ref: 'image-abc-10x10-jpg' } }).url()).toBe('https://cdn.sanity.io/images/testproj/test/abc-10x10.jpg')
    expect(formatPrice(250_000)).toBe('₦2,500')
  })
})

describe('styleImages', () => {
  it('has a photo for every try-on style: one for gendered, two for unisex', () => {
    for (const s of TRY_ON_STYLES) {
      if (s.gender === 'unisex') expect(UNISEX_STYLE_IMAGES[s.id], s.id).toBeDefined()
      else expect(STYLE_IMAGES[s.id], s.id).toBeDefined()
    }
    expect(Object.keys(STYLE_IMAGES).length + Object.keys(UNISEX_STYLE_IMAGES).length).toBe(TRY_ON_STYLES.length)
  })

  it('picks the gender variant for unisex styles', () => {
    expect(getStyleImage('afro', 'male')).toEqual({ testUri: 'assets/styles/afro-men.jpg' })
    expect(getStyleImage('afro', 'female')).toEqual({ testUri: 'assets/styles/afro-women.jpg' })
    expect(getStyleImage('buzz', 'female')).toEqual({ testUri: 'assets/styles/buzz.jpg' })
    expect(getStyleImage('nope', 'male')).toBeUndefined()
  })
})

describe('constants', () => {
  it('match the server tier thresholds and points rule', () => {
    expect(constants.TIER_THRESHOLDS).toEqual({ silver: 5, gold: 15, platinum: 30 })
    expect(Object.keys(constants.TIER_COLORS)).toEqual(['bronze', 'silver', 'gold', 'platinum'])
    expect(constants.POINTS_PER_100_NAIRA).toBe(1)
    for (const c of Object.values(constants.COLORS)) expect(c).toMatch(/^#[0-9A-F]{6}$/)
  })
})
