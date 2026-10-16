// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { router, setParams } from '../stubs/expo-router'
import { Alert } from '../stubs/react-native'
import { pressAlertButton, renderScreen } from '../helpers/screen'
import { routeApi, sent } from '../helpers/api'

vi.mock('@/lib/api', async (orig) => ({ ...(await orig<typeof import('@/lib/api')>()), api: vi.fn() }))
vi.mock('@/lib/realtime', () => ({ disconnectRealtime: vi.fn() }))
vi.mock('@/lib/payments', () => ({ payWithPaystack: vi.fn() }))

const { api, ApiError } = await import('@/lib/api')
const { payWithPaystack } = await import('@/lib/payments')
const { useAuthStore } = await import('@/store/authStore')
const { useCartStore } = await import('@/store/cartStore')

const alert = vi.mocked(Alert.alert)
const customer = { _id: 'c1', fullName: 'Ada Obi', phone: '08012345678', walletBalance: 1_000_000, loyaltyPoints: 10, preferredCurrency: 'NGN' }
const product = (id: string, over: object = {}) => ({ _id: id, name: `Product ${id}`, slug: { current: id }, price: 200_000, stock: 10, pointsEarned: 20, ...over }) as never

beforeEach(() => {
  setParams({})
  useAuthStore.setState({ customer: customer as never, isAuthenticated: true })
  useCartStore.getState().clearCart()
})

describe('cart', () => {
  it('shows an empty cart with a way back to the shop', async () => {
    const { default: Cart } = await import('@/app/cart')
    const s = await renderScreen(<Cart />)
    expect(s.text()).toContain('Your cart is empty')
    await s.press('Browse Products')
    expect(router.push).toHaveBeenCalledWith('/(tabs)/shop')
  })

  it('changes quantities, removes items and totals the cart', async () => {
    useCartStore.getState().addItem(product('gel'), 2)
    useCartStore.getState().addItem(product('comb', { price: 50_000 }))
    const { default: Cart } = await import('@/app/cart')
    const s = await renderScreen(<Cart />)
    expect(s.text()).toContain('My Cart (2)')
    expect(s.text()).toContain('Total₦4,500')
    await s.press(s.container.querySelectorAll('i[data-icon="add"]')[0].closest('button')!)
    expect(useCartStore.getState().items[0].quantity).toBe(3)
    await s.press(s.container.querySelectorAll('i[data-icon="remove"]')[1].closest('button')!)
    expect(useCartStore.getState().items.map((i) => i.product._id)).toEqual(['gel'])
    await s.press(s.iconButton('trash-outline'))
    expect(s.text()).toContain('Your cart is empty')
  })

  it('applies and removes a discount code', async () => {
    routeApi(api, { 'POST /api/v1/discounts/validate': { _id: 'd', code: 'TEN', type: 'percentage', value: 10 } })
    useCartStore.getState().addItem(product('gel'))
    const { default: Cart } = await import('@/app/cart')
    const s = await renderScreen(<Cart />)
    await s.type('Enter code...', 'ten')
    await s.press('Apply')
    expect(sent(api, 'POST /api/v1/discounts/validate')).toEqual([{ code: 'TEN', context: 'order', subtotal: 200_000 }])
    expect(s.text()).toContain('Discount-₦200')
    expect(s.text()).toContain('Proceed to Checkout — ₦1,800')
    await s.press('Remove')
    expect(s.text()).not.toContain('Discount-')
    await s.press('Proceed to Checkout')
    expect(router.push).toHaveBeenCalledWith('/checkout')
  })

  it('alerts invalid codes and clears the cart after confirmation', async () => {
    routeApi(api, { 'POST /api/v1/discounts/validate': new ApiError(400, 'This code has reached its usage limit.') })
    useCartStore.getState().addItem(product('gel'))
    const { default: Cart } = await import('@/app/cart')
    const s = await renderScreen(<Cart />)
    await s.type('Enter code...', 'used')
    await s.press('Apply')
    expect(alert).toHaveBeenLastCalledWith('Invalid Code', 'This code has reached its usage limit.')
    await s.press(/^Clear$/)
    await pressAlertButton(alert, 'Clear')
    expect(useCartStore.getState().items).toEqual([])
  })
})

describe('checkout', () => {
  async function fillAndPlace(s: Awaited<ReturnType<typeof renderScreen>>) {
    await s.type('12 Lagos Road', '1 Admiralty Way')
    await s.type(/^Lagos$/, 'Lekki')
    await s.type(/^Lagos State$/, 'Lagos')
    await s.press('Place Order')
  }

  beforeEach(() => {
    useCartStore.getState().addItem(product('gel'), 2)
  })

  it('pays from the wallet and refreshes balances', async () => {
    routeApi(api, {
      'POST /api/v1/orders': { _id: 'o1', orderNumber: 'CUT-1', status: 'paid' },
      'GET /api/v1/me': { ...customer, walletBalance: 600_000, loyaltyPoints: 50 },
    })
    const { default: Checkout } = await import('@/app/checkout')
    const s = await renderScreen(<Checkout />)
    expect(s.input('Recipient name').value).toBe('Ada Obi') // prefilled
    await fillAndPlace(s)
    expect(sent(api, 'POST /api/v1/orders')).toEqual([{
      items: [{ productId: 'gel', quantity: 2 }],
      shippingAddress: { fullName: 'Ada Obi', address: '1 Admiralty Way', city: 'Lekki', state: 'Lagos', phone: '08012345678' },
      paymentMethod: 'wallet',
      discountCode: undefined,
    }])
    expect(useAuthStore.getState().customer).toMatchObject({ walletBalance: 600_000, loyaltyPoints: 50 })
    expect(useCartStore.getState().items).toEqual([])
    expect(alert).toHaveBeenLastCalledWith('Order Placed! 🎉', 'Order #CUT-1 placed successfully.', expect.any(Array))
    await pressAlertButton(alert, 'View Orders')
    expect(router.replace).toHaveBeenCalledWith('/orders')
  })

  it('stops a wallet order the balance cannot cover', async () => {
    useAuthStore.setState({ customer: { ...customer, walletBalance: 100 } as never })
    const { default: Checkout } = await import('@/app/checkout')
    const s = await renderScreen(<Checkout />)
    await fillAndPlace(s)
    expect(alert).toHaveBeenLastCalledWith('Insufficient Balance', expect.stringContaining('₦1'), expect.any(Array))
    expect(api).not.toHaveBeenCalledWith('POST', '/api/v1/orders', expect.anything())
    await pressAlertButton(alert, 'Top Up')
    expect(router.push).toHaveBeenCalledWith('/wallet')
  })

  it('pays by card through Paystack', async () => {
    routeApi(api, {
      'POST /api/v1/orders': { _id: 'o1', orderNumber: 'CUT-2', status: 'pending', authorizationUrl: 'https://paystack/x', reference: 'ref1' },
      'GET /api/v1/me': customer,
    })
    vi.mocked(payWithPaystack).mockResolvedValue('completed')
    const { default: Checkout } = await import('@/app/checkout')
    const s = await renderScreen(<Checkout />)
    await s.press('Card Payment')
    await fillAndPlace(s)
    expect(payWithPaystack).toHaveBeenCalledWith('https://paystack/x', 'ref1')
    expect(alert).toHaveBeenLastCalledWith('Order Placed! 🎉', expect.any(String), expect.any(Array))
  })

  it.each([
    ['pending', 'Order received'],
    ['failed', 'Payment not completed'],
  ] as const)('reports a %s card payment', async (outcome, title) => {
    routeApi(api, {
      'POST /api/v1/orders': { _id: 'o1', orderNumber: 'CUT-3', status: 'pending', authorizationUrl: 'u', reference: 'r' },
      'GET /api/v1/me': customer,
    })
    vi.mocked(payWithPaystack).mockResolvedValue(outcome)
    const { default: Checkout } = await import('@/app/checkout')
    const s = await renderScreen(<Checkout />)
    await s.press('Card Payment')
    await fillAndPlace(s)
    expect(alert).toHaveBeenLastCalledWith(title, expect.stringContaining('CUT-3'), expect.any(Array))
    expect(useCartStore.getState().items.length > 0).toBe(outcome === 'failed')
  })

  it('stylist shops: no wallet option, and transfers wait for the stylist', async () => {
    useCartStore.getState().replaceWith(product('oil', { seller: { _id: 'st1', name: 'Ada Hair' } }))
    routeApi(api, { 'POST /api/v1/orders': { _id: 'o1', orderNumber: 'CUT-4', status: 'pending', awaitingSeller: true } })
    const { default: Checkout } = await import('@/app/checkout')
    const s = await renderScreen(<Checkout />)
    expect(s.text()).toContain('Sold by Ada Hair')
    expect(s.hasButton(/^Wallet/)).toBe(false)
    await s.press('Bank Transfer to Stylist')
    await fillAndPlace(s)
    expect(sent(api, 'POST /api/v1/orders')[0]).toMatchObject({ paymentMethod: 'transfer' })
    expect(alert).toHaveBeenLastCalledWith('Order sent to the stylist', expect.stringContaining('CUT-4'), expect.any(Array))
    expect(useCartStore.getState().items).toEqual([])
  })

  it('names the stylist in the transfer instructions', async () => {
    useCartStore.getState().replaceWith(product('oil', { seller: { _id: 'st1', name: 'Ada Hair' } }))
    routeApi(api, { 'POST /api/v1/orders': { _id: 'o1', orderNumber: 'CUT-4', status: 'pending', awaitingSeller: true } })
    const { default: Checkout } = await import('@/app/checkout')
    const s = await renderScreen(<Checkout />)
    await s.press('Bank Transfer to Stylist')
    await fillAndPlace(s)
    expect(alert).toHaveBeenLastCalledWith('Order sent to the stylist', expect.stringContaining('waiting for Ada Hair'), expect.any(Array))
  })

  it('validates the address and surfaces server errors', async () => {
    routeApi(api, { 'POST /api/v1/orders': new ApiError(400, 'Only 1 of Gel left in stock.') })
    const { default: Checkout } = await import('@/app/checkout')
    const s = await renderScreen(<Checkout />)
    await s.press('Place Order')
    expect(api).not.toHaveBeenCalled()
    await fillAndPlace(s)
    expect(alert).toHaveBeenLastCalledWith('Error', 'Only 1 of Gel left in stock.')
  })
})

describe('product/[slug]', () => {
  beforeEach(() => setParams({ slug: 'gel' }))

  it('shows the product and adds the chosen quantity to the cart', async () => {
    routeApi(api, { 'GET /api/v1/catalog/products/gel': product('gel', { stock: 4, compareAtPrice: 400_000, tags: ['hold', 'shine'], category: { name: 'Hair' }, seller: { _id: 'st1', name: 'Ada Hair' } }) })
    const { default: ProductScreen } = await import('@/app/product/[slug]')
    const s = await renderScreen(<ProductScreen />)
    for (const t of ['Product gel', '50% OFF', 'Sold by Ada Hair', 'hold · shine', 'Earn 20 points', '4 in stock', 'Only 4 left!']) expect(s.text()).toContain(t)
    for (let i = 0; i < 5; i++) await s.press(s.iconButton('add'))
    expect(s.text()).toContain('Add to Cart — ₦8,000') // capped at stock
    await s.press(s.iconButton('remove'))
    await s.press('Add to Cart')
    expect(useCartStore.getState().items).toEqual([{ product: expect.objectContaining({ _id: 'gel' }), quantity: 3 }])
    expect(router.push).toHaveBeenCalledWith('/cart')
  })

  it('disables out-of-stock products and handles unknown slugs', async () => {
    routeApi(api, { 'GET /api/v1/catalog/products/gel': product('gel', { stock: 0 }) })
    const { default: ProductScreen } = await import('@/app/product/[slug]')
    expect((await renderScreen(<ProductScreen />)).button('Out of Stock').disabled).toBe(true)
    setParams({ slug: 'missing' })
    routeApi(api, {})
    expect((await renderScreen(<ProductScreen />)).text()).toBe('Product not found')
  })
})

describe('orders', () => {
  it('lists orders with status, thumbnails and totals', async () => {
    routeApi(api, { 'GET /api/v1/orders': [{
      _id: 'o1', orderNumber: 'CUT-9', status: 'shipped', totalAmount: 450_000, createdAt: '2026-06-01T10:00:00Z',
      items: [1, 2, 3, 4, 5].map((i) => ({ quantity: 1, product: { _id: `p${i}` } })),
    }] })
    const { default: Orders } = await import('@/app/orders')
    const s = await renderScreen(<Orders />)
    for (const t of ['Order #CUT-9', 'shipped', '+2', '₦4,500']) expect(s.text()).toContain(t)
  })

  it('shows an empty state', async () => {
    routeApi(api, { 'GET /api/v1/orders': [] })
    const { default: Orders } = await import('@/app/orders')
    const s = await renderScreen(<Orders />)
    await s.press('Start Shopping')
    expect(router.push).toHaveBeenCalledWith('/(tabs)/shop')
  })
})

describe('payment-complete', () => {
  it('returns to the home tabs', async () => {
    const { default: PaymentComplete } = await import('@/app/payment-complete')
    expect((await renderScreen(<PaymentComplete />)).redirect()).toBe('/(tabs)')
  })
})

describe('payment-methods', () => {
  const card = (key: string, isDefault: boolean, last4 = '4242') => ({ _key: key, brand: 'visa', last4, expiryMonth: 3, expiryYear: 2029, holderName: 'Ada', isDefault })

  it('adds a card, storing only brand, last 4 and expiry', async () => {
    routeApi(api, { 'PUT /api/v1/me/payment-methods': { ok: true } })
    const { default: PaymentMethods } = await import('@/app/payment-methods')
    const s = await renderScreen(<PaymentMethods />)
    expect(s.text()).toContain('No saved cards yet')
    await s.press('Add New Card')
    await s.type('John Doe', 'Ada Obi')
    await s.type('4242 4242 4242 4242', '5061 2345 6789 0123')
    await s.type('12/28', '07/30')
    await s.press('Save Card')
    const [{ paymentMethods }] = sent(api, 'PUT /api/v1/me/payment-methods') as Array<{ paymentMethods: object[] }>
    expect(paymentMethods).toEqual([{ _key: expect.any(String), brand: 'verve', last4: '0123', expiryMonth: 7, expiryYear: 2030, holderName: 'Ada Obi', isDefault: true }])
    expect(JSON.stringify(paymentMethods)).not.toContain('5061')
    expect(s.text()).toContain('verve •••• 0123')
  })

  it.each([
    ['', '4242424242424242', '12/28', 'Missing Info'],
    ['Ada', '4242', '12/28', 'Invalid Card'],
    ['Ada', '4242424242424242', '13/28', 'Invalid Expiry'],
  ])('rejects %j/%j/%j', async (name, number, expiry, title) => {
    const { default: PaymentMethods } = await import('@/app/payment-methods')
    const s = await renderScreen(<PaymentMethods />)
    await s.press('Add New Card')
    if (name) await s.type('John Doe', name)
    await s.type('4242 4242 4242 4242', number)
    await s.type('12/28', expiry)
    await s.press('Save Card')
    expect(alert).toHaveBeenLastCalledWith(title, expect.any(String))
    expect(api).not.toHaveBeenCalled()
  })

  it('sets the default card and promotes another when the default is removed', async () => {
    useAuthStore.setState({ customer: { ...customer, paymentMethods: [card('a', true, '1111'), card('b', false, '2222')] } as never })
    routeApi(api, { 'PUT /api/v1/me/payment-methods': { ok: true } })
    const { default: PaymentMethods } = await import('@/app/payment-methods')
    const s = await renderScreen(<PaymentMethods />)
    await s.press('visa •••• 2222')
    expect((sent(api, 'PUT /api/v1/me/payment-methods')[0] as { paymentMethods: Array<{ isDefault: boolean }> }).paymentMethods.map((c) => c.isDefault)).toEqual([false, true])

    await s.press(s.container.querySelectorAll('i[data-icon="trash-outline"]')[1].closest('button')!)
    await pressAlertButton(alert, 'Remove')
    expect((sent(api, 'PUT /api/v1/me/payment-methods')[1] as { paymentMethods: Array<{ _key: string; isDefault: boolean }> }).paymentMethods).toEqual([expect.objectContaining({ _key: 'a', isDefault: true })])
  })
})

describe('wallet', () => {
  const txs = [
    { _id: 't1', type: 'credit', category: 'topup', amount: 500_000, balanceAfter: 1_000_000, status: 'completed', description: 'Wallet top-up', createdAt: '2026-06-01T10:00:00Z' },
    { _id: 't2', type: 'debit', category: 'withdrawal', amount: 100_000, balanceAfter: 900_000, status: 'pending', createdAt: '2026-06-02T10:00:00Z' },
  ]

  it('shows the balance and transaction history', async () => {
    routeApi(api, { 'GET /api/v1/wallet/transactions': txs })
    const { default: Wallet } = await import('@/app/wallet')
    const s = await renderScreen(<Wallet />)
    for (const t of ['₦10,000', 'Wallet top-up', '+₦5,000', 'withdrawal', '-₦1,000', 'pending', 'Bal: ₦9,000']) expect(s.text()).toContain(t)
  })

  it('tops up via Paystack and refreshes the balance', async () => {
    routeApi(api, {
      'GET /api/v1/wallet/transactions': [],
      'POST /api/v1/wallet/topup': { authorizationUrl: 'https://paystack/t', reference: 'cutty_top_x' },
      'GET /api/v1/me': { ...customer, walletBalance: 2_000_000 },
    })
    vi.mocked(payWithPaystack).mockResolvedValue('completed')
    const { default: Wallet } = await import('@/app/wallet')
    const s = await renderScreen(<Wallet />)
    await s.press(/^Top Up$/)
    await s.press('₦10,000')
    await s.press('Top Up ₦10,000')
    expect(sent(api, 'POST /api/v1/wallet/topup')).toEqual([{ amount: 1_000_000 }])
    expect(payWithPaystack).toHaveBeenCalledWith('https://paystack/t', 'cutty_top_x')
    expect(useAuthStore.getState().customer!.walletBalance).toBe(2_000_000)
    expect(alert).toHaveBeenLastCalledWith('Success! 💰', '₦10,000 added to your wallet.')
  })

  it('validates custom top-up amounts and reports pending payments', async () => {
    routeApi(api, {
      'GET /api/v1/wallet/transactions': [],
      'POST /api/v1/wallet/topup': { authorizationUrl: 'u', reference: 'r' },
      'GET /api/v1/me': customer,
    })
    vi.mocked(payWithPaystack).mockResolvedValue('pending')
    const { default: Wallet } = await import('@/app/wallet')
    const s = await renderScreen(<Wallet />)
    await s.press(/^Top Up$/)
    await s.type('₦ Enter amount...', '50')
    await s.press('Top Up ₦50')
    expect(alert).toHaveBeenLastCalledWith('Invalid Amount', 'Minimum top-up is ₦100.')
    await s.type('₦ Enter amount...', '250.5')
    await s.press('Top Up ₦250.5')
    expect(sent(api, 'POST /api/v1/wallet/topup')).toEqual([{ amount: 25_050 }])
    expect(alert).toHaveBeenLastCalledWith('Payment processing', expect.any(String))
  })

  it('requests a withdrawal within the balance', async () => {
    routeApi(api, { 'GET /api/v1/wallet/transactions': [], 'POST /api/v1/wallet/withdraw': { walletBalance: 700_000 } })
    const { default: Wallet } = await import('@/app/wallet')
    const s = await renderScreen(<Wallet />)
    await s.press(/^Withdraw$/)
    await s.type('₦ Enter amount...', '20000')
    await s.press('Withdraw ₦20,000')
    expect(alert).toHaveBeenLastCalledWith('Insufficient Balance', expect.any(String))
    await s.type('₦ Enter amount...', '3000')
    await s.press('Withdraw ₦3,000')
    expect(sent(api, 'POST /api/v1/wallet/withdraw')).toEqual([{ amount: 300_000 }])
    expect(useAuthStore.getState().customer!.walletBalance).toBe(700_000)
    expect(alert).toHaveBeenLastCalledWith('Withdrawal requested', expect.stringContaining('₦3,000'))
  })
})
