// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Alert, useColorScheme } from '../stubs/react-native'
import { cssInterop } from '../stubs/nativewind'
import { act, renderHook } from '../helpers/render'

vi.mock('@/lib/api', async (orig) => ({ ...(await orig<typeof import('@/lib/api')>()), api: vi.fn() }))
vi.mock('@/lib/realtime', () => ({ disconnectRealtime: vi.fn() }))

const { api } = await import('@/lib/api')
const { formatKobo, loadExchangeRates, useFormatPrice, usePreferredCurrency } = await import('@/lib/currency')
const { DARK_THEME_VARS, useColorSchemeSetting, useTheme } = await import('@/lib/theme')
const { addToCart } = await import('@/lib/cart')
const { useAuthStore } = await import('@/store/authStore')
const { useThemeStore } = await import('@/store/themeStore')
const { useCartStore } = await import('@/store/cartStore')

// Captured at import, before mockReset clears call history.
const interopCall = vi.mocked(cssInterop).mock.calls[0]

const rates = { NGN: 1, USD: 1500, GBP: 2000 }

describe('formatKobo', () => {
  it('formats naira directly and converts other currencies for display', () => {
    expect(formatKobo(1_234_500, 'NGN', rates)).toBe('₦12,345')
    expect(formatKobo(300_000, 'USD', rates)).toBe('$2.00')
    expect(formatKobo(100_000, 'GBP', rates)).toBe('£0.50')
  })
})

describe('exchange rates and price hooks', () => {
  beforeEach(() => {
    useAuthStore.setState({ customer: null })
  })

  it('formats in NGN by default and in the customer’s currency once set', async () => {
    const { result } = await renderHook(() => ({ fmt: useFormatPrice(), cur: usePreferredCurrency() }))
    expect(result.current.cur).toBe('NGN')
    expect(result.current.fmt(10_000)).toBe('₦100')
    await act(async () => useAuthStore.setState({ customer: { preferredCurrency: 'USD' } as never }))
    expect(result.current.cur).toBe('USD')
    expect(result.current.fmt(155_000)).toBe('$1.00') // default USD rate 1550
  })

  it('uses positive rates from the server and keeps defaults otherwise', async () => {
    useAuthStore.setState({ customer: { preferredCurrency: 'GBP' } as never })
    vi.mocked(api).mockResolvedValueOnce({ USD: 1000, GBP: -5 })
    await loadExchangeRates()
    expect(api).toHaveBeenCalledWith('GET', '/api/v1/catalog/exchange-rates')
    const { result } = await renderHook(() => useFormatPrice())
    expect(result.current(205_000)).toBe('£1.00') // default GBP rate kept
    useAuthStore.setState({ customer: { preferredCurrency: 'USD' } as never })
    const usd = await renderHook(() => useFormatPrice())
    expect(usd.result.current(100_000)).toBe('$1.00')
  })

  it('ignores missing or failed rate lookups', async () => {
    vi.mocked(api).mockResolvedValueOnce(null)
    await expect(loadExchangeRates()).resolves.toBeUndefined()
    vi.mocked(api).mockRejectedValueOnce(new Error('offline'))
    await expect(loadExchangeRates()).resolves.toBeUndefined()
  })
})

describe('theme', () => {
  it('registers Ionicons for className colours at import', () => {
    expect(interopCall?.[1]).toEqual({ className: { target: 'style', nativeStyleToProp: { color: true } } })
  })

  it('exposes RGB channel CSS variables for the dark palette', () => {
    expect(DARK_THEME_VARS).toMatchObject({ __vars: { '--color-fg': '255 255 255', '--color-dark-900': '17 17 17', '--color-primary-400': '241 169 31' } })
  })

  it('follows the stored mode, or the system scheme in "system" mode', async () => {
    useThemeStore.setState({ mode: 'light' })
    const { result } = await renderHook(() => useTheme())
    expect(result.current.scheme).toBe('light')
    expect(result.current.colors.fg).toBe('#111111')
    expect(result.current.themeVars).toMatchObject({ __vars: { '--color-fg': '17 17 17' } })

    useThemeStore.setState({ mode: 'system' })
    useColorScheme.mockReturnValue('light')
    expect((await renderHook(() => useColorSchemeSetting())).result.current).toBe('light')
    useColorScheme.mockReturnValue(null)
    expect((await renderHook(() => useColorSchemeSetting())).result.current).toBe('dark')
  })
})

describe('addToCart', () => {
  const p = (id: string, seller?: string) => ({ _id: id, price: 100, pointsEarned: 0, seller: seller ? { _id: seller, name: `Shop ${seller}` } : undefined }) as never

  beforeEach(() => useCartStore.getState().clearCart())

  it('adds straight away when there is no conflict', async () => {
    await expect(addToCart(p('a'))).resolves.toBe(true)
    expect(Alert.alert).not.toHaveBeenCalled()
  })

  it('asks before replacing another shop’s cart', async () => {
    useCartStore.getState().addItem(p('a', 's1'))
    const pending = addToCart(p('b'), 2)
    const [title, message, buttons] = vi.mocked(Alert.alert).mock.calls[0] as [string, string, Array<{ text: string; onPress: () => void }>]
    expect(title).toBe('Start a new cart?')
    expect(message).toContain('Shop s1')
    buttons.find((b) => b.text === 'Start new cart')!.onPress()
    await expect(pending).resolves.toBe(true)
    expect(useCartStore.getState().items).toEqual([{ product: expect.objectContaining({ _id: 'b' }), quantity: 2 }])
  })

  it('keeps the cart when the customer declines', async () => {
    useCartStore.getState().addItem(p('a', 's1'))
    const pending = addToCart(p('b'))
    const buttons = vi.mocked(Alert.alert).mock.calls[0][2] as Array<{ text: string; onPress: () => void }>
    buttons.find((b) => b.text === 'Keep my cart')!.onPress()
    await expect(pending).resolves.toBe(false)
    expect(useCartStore.getState().items.map((i) => i.product._id)).toEqual(['a'])
  })
})
