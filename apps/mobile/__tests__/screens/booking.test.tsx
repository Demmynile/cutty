// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { router, setParams } from '../stubs/expo-router'
import { Alert } from '../stubs/react-native'
import { alertButtons, pressAlertButton, renderScreen } from '../helpers/screen'
import { routeApi, sent } from '../helpers/api'

vi.mock('@/lib/api', async (orig) => ({ ...(await orig<typeof import('@/lib/api')>()), api: vi.fn() }))
vi.mock('@/lib/realtime', () => ({ disconnectRealtime: vi.fn() }))

const { api, ApiError } = await import('@/lib/api')
const { useAuthStore } = await import('@/store/authStore')
const { useBookingStore } = await import('@/store/bookingStore')

const alert = vi.mocked(Alert.alert)
// Customers book a stylist (map or search), not a service: the stylist's
// appointment price and length set the total and the slot.
const tunde = {
  _id: 'st1', name: 'Tunde', kind: 'barber', barberId: 'b1', bookingPrice: 700_000, bookingDuration: 60,
  rating: 4.5, skills: ['Fades'], styles: ['taper-fade', 'Beard sculpt'], weeklyAvailability: [], hasShop: false, location: { lat: 6.5, lng: 3.4, area: 'Yaba' },
}
const ada = {
  _id: 'st2', name: 'Ada', kind: 'braider', barberId: 'b-ada', bookingPrice: 2_500_000, bookingDuration: 240,
  skills: ['Braids'], styles: ['knotless-braids'], weeklyAvailability: [], hasShop: false,
}
const unpriced = { _id: 'st3', name: 'No Price Pat', kind: 'barber', barberId: 'b3', skills: [], styles: [], weeklyAvailability: [], hasShop: false }
const stylists = [tunde, ada, unpriced]

// The first selectable date is tomorrow (local time), as the screen computes it.
function tomorrow() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return {
    iso: d.toISOString().split('T')[0],
    label: `${d.toLocaleDateString('en', { weekday: 'short' })}${d.getDate()}${d.toLocaleDateString('en', { month: 'short' })}`,
  }
}

beforeEach(() => {
  document.body.innerHTML = ''
  setParams({})
  useAuthStore.setState({ customer: { _id: 'c1', preferredCurrency: 'NGN' } as never, isAuthenticated: true })
})

describe('booking/new', () => {
  beforeEach(() => {
    routeApi(api, {
      'GET /api/v1/stylists': stylists,
      'GET /api/v1/stylists/st1': tunde,
      'GET /api/v1/stylists/st2': ada,
      'GET /api/v1/availability*': (_b: unknown, path: string) => ({ slots: path.includes('barberId=b1') ? ['10:00', '10:30'] : [] }),
      'POST /api/v1/discounts/validate': { _id: 'd1', code: 'TEN', type: 'percentage', value: 10 },
      'POST /api/v1/bookings': { _id: 'bk-new' },
    })
  })

  async function toConfirm() {
    const { default: NewBooking } = await import('@/app/booking/new')
    const s = await renderScreen(<NewBooking />)
    expect(s.text()).toContain('Pick on the map')
    expect(s.text()).not.toContain('No Price Pat') // can't be booked until they set a price
    expect(s.hasButton('Continue')).toBe(false) // tapping a stylist advances
    await s.press('Tunde')
    expect(s.text()).toMatch(/Tunde\S+ · 60 minChange/)
    await s.press('Taper Fade')
    await s.press('Continue')
    expect(s.text()).toContain('Pick a date to see free times.')
    await s.press(tomorrow().label)
    await s.press('10:30')
    await s.type('Any special requests...', 'Low fade')
    await s.press('Continue')
    return s
  }

  it('walks stylist → style → time → confirm and books it at the stylist’s price', async () => {
    const s = await toConfirm()
    expect(vi.mocked(api)).toHaveBeenCalledWith('GET', `/api/v1/availability?barberId=b1&date=${tomorrow().iso}&duration=60`)
    for (const t of ['StylistTunde', 'StyleTaper Fade', `${tomorrow().iso} at 10:30`, '60 minutes', 'Appointment₦7,000', '+70 pts']) expect(s.text()).toContain(t)
    expect(s.text()).not.toMatch(/service/i)

    await s.press('Confirm Booking — ₦7,000')
    expect(sent(api, 'POST /api/v1/bookings')).toEqual([{ barberId: 'b1', style: 'taper-fade', date: tomorrow().iso, time: '10:30', notes: 'Low fade', discountCode: undefined }])
    expect(alert).toHaveBeenLastCalledWith('Booking Confirmed! ✅', expect.stringContaining('10:30'), expect.any(Array))
    await pressAlertButton(alert, 'View Booking')
    expect(router.replace).toHaveBeenCalledWith('/booking/bk-new')
  })

  it('searches stylists by name, area or style, and opens the map', async () => {
    const { default: NewBooking } = await import('@/app/booking/new')
    const s = await renderScreen(<NewBooking />)
    await s.type('Search name, area or style', 'knotless')
    expect(s.text()).toContain('Ada')
    expect(s.text()).not.toContain('Tunde')
    await s.type('Search name, area or style', 'yaba')
    expect(s.text()).toContain('Tunde')
    await s.type('Search name, area or style', 'nobody')
    expect(s.text()).toContain('No bookable stylists match')
    await s.press('Pick on the map')
    expect(router.replace).toHaveBeenCalledWith('/explore')
  })

  it('books without a style, to decide with the stylist', async () => {
    const { default: NewBooking } = await import('@/app/booking/new')
    const s = await renderScreen(<NewBooking />)
    await s.press('Tunde')
    await s.press("Not sure yet, I'll decide with Tunde")
    await s.press('Continue')
    await s.press(tomorrow().label)
    await s.press('10:00')
    await s.press('Continue')
    expect(s.text()).toContain('StyleDecide with stylist')
    await s.press('Confirm Booking')
    expect(sent(api, 'POST /api/v1/bookings')[0]).toMatchObject({ barberId: 'b1', style: undefined })
  })

  it('applies a discount code before booking', async () => {
    const s = await toConfirm()
    await s.type('Enter code...', ' ten ')
    await s.press('Apply')
    expect(sent(api, 'POST /api/v1/discounts/validate')).toEqual([{ code: 'TEN', context: 'booking', subtotal: 700_000 }])
    expect(s.text()).toContain('Discount (TEN)-₦700')
    expect(s.text()).toContain('TEN applied')
    await s.press('Confirm Booking — ₦6,300')
    expect(sent(api, 'POST /api/v1/bookings')[0]).toMatchObject({ discountCode: 'TEN' })
  })

  it('reports invalid codes and failed bookings', async () => {
    const s = await toConfirm()
    routeApi(api, {
      'POST /api/v1/discounts/validate': new ApiError(400, 'This discount code has expired.'),
      'POST /api/v1/bookings': new ApiError(409, 'That time was just booked. Please pick another slot.'),
      'GET *': [],
    })
    await s.type('Enter code...', 'OLD')
    await s.press('Apply')
    expect(alert).toHaveBeenLastCalledWith('Invalid Code', 'This discount code has expired.')
    await s.press('Confirm Booking')
    expect(alert).toHaveBeenLastCalledWith('Error', 'That time was just booked. Please pick another slot.')
  })

  it('says when a day has no free times, and back steps through the flow', async () => {
    routeApi(api, { 'GET /api/v1/stylists': stylists, 'GET /api/v1/stylists/st1': tunde, 'GET /api/v1/availability*': { slots: [] } })
    const { default: NewBooking } = await import('@/app/booking/new')
    const s = await renderScreen(<NewBooking />)
    await s.press('Tunde')
    await s.press('Continue')
    await s.press(tomorrow().label)
    expect(s.text()).toContain('No free times on this day.')
    expect(s.button('Continue').disabled).toBe(true)
    await s.press(s.iconButton('arrow-back'))
    expect(s.text()).toContain('What would you like?')
    await s.press(s.iconButton('arrow-back'))
    expect(s.text()).toContain('Pick on the map')
    await s.press(s.iconButton('arrow-back'))
    expect(router.back).toHaveBeenCalled()
  })

  it("lists the stylist's own styles with try-on links", async () => {
    const { default: NewBooking } = await import('@/app/booking/new')
    const s = await renderScreen(<NewBooking />)
    await s.press('Tunde')
    expect(s.text()).toContain('Taper Fade')
    expect(s.text()).toContain('Beard sculpt') // custom styles show as written
    expect(s.text()).not.toContain('Buzz Cut')
    await s.press(s.container.querySelector('[data-icon="color-wand-outline"]')!.closest('button')!)
    expect(router.push).toHaveBeenCalledWith('/ai/tryon?styleId=taper-fade')
  })

  it("starts from a stylist's profile with the stylist chosen, and can change them", async () => {
    setParams({ stylistId: 'st2' })
    routeApi(api, {
      'GET /api/v1/stylists': stylists,
      'GET /api/v1/stylists/st2': ada,
      'GET /api/v1/availability*': { slots: ['12:00'] },
      'POST /api/v1/bookings': { _id: 'bk2' },
    })
    const { default: NewBooking } = await import('@/app/booking/new')
    const s = await renderScreen(<NewBooking />)
    expect(s.text()).toContain('Ada')
    expect(s.text()).toContain('₦25,000 · 240 min')
    await s.press('Knotless Braids')
    await s.press('Continue')
    await s.press(tomorrow().label)
    expect(vi.mocked(api)).toHaveBeenCalledWith('GET', `/api/v1/availability?barberId=b-ada&date=${tomorrow().iso}&duration=240`)
    await s.press('12:00')
    await s.press('Continue')
    await s.press('Confirm Booking')
    expect(sent(api, 'POST /api/v1/bookings')[0]).toMatchObject({ barberId: 'b-ada', style: 'knotless-braids' })
  })

  it('preselects a try-on style and puts stylists who do it first', async () => {
    setParams({ style: 'knotless-braids' })
    const { default: NewBooking } = await import('@/app/booking/new')
    const s = await renderScreen(<NewBooking />)
    expect(s.text().indexOf('Ada')).toBeLessThan(s.text().indexOf('Tunde'))
    expect(s.text()).toContain('Does Knotless Braids')
    await s.press('Ada')
    await s.press('Continue')
    await s.press(s.iconButton('arrow-back'))
    expect(s.container.querySelector('[data-icon="checkmark-circle"]')?.closest('div')?.textContent).toContain('Knotless Braids')
  })

  it('goes back to the list when the stylist is not taking bookings', async () => {
    setParams({ stylistId: 'gone' })
    routeApi(api, { 'GET /api/v1/stylists': stylists })
    const { default: NewBooking } = await import('@/app/booking/new')
    const s = await renderScreen(<NewBooking />)
    expect(alert).toHaveBeenLastCalledWith('Unavailable', expect.any(String))
    expect(s.text()).toContain('Pick on the map')
  })

  it('shows the naira charge when the customer prefers another currency', async () => {
    useAuthStore.setState({ customer: { _id: 'c1', preferredCurrency: 'USD' } as never })
    const s = await toConfirm()
    expect(s.text()).toContain('Charged in Naira: ₦7,000')
  })

  it('starts with a fresh draft', async () => {
    useBookingStore.getState().setStylist(ada as never)
    const { default: NewBooking } = await import('@/app/booking/new')
    await renderScreen(<NewBooking />)
    expect(useBookingStore.getState().draft.stylist).toBeNull()
  })
})

describe('booking/[id]', () => {
  const booking = {
    _id: 'bk1', bookingDate: '2026-07-01', startTime: '10:00', endTime: '11:00', status: 'confirmed',
    totalAmount: 630_000, discountAmount: 70_000, pointsEarned: 70, notes: 'Low fade',
    barber: { _id: 'b1', name: 'Tunde' }, style: 'skin-fade',
  }

  beforeEach(() => setParams({ id: 'bk1' }))

  it('shows the booking details and payment breakdown', async () => {
    routeApi(api, { 'GET /api/v1/bookings/bk1': booking })
    const { default: Detail } = await import('@/app/booking/[id]')
    const s = await renderScreen(<Detail />)
    for (const t of ['2026-07-01', 'confirmed', '10:00 – 11:00', 'Tunde', 'Skin Fade', 'Subtotal₦7,000', 'Discount-₦700', 'Total Paid₦6,300', '+70 pts', 'Low fade']) {
      expect(s.text()).toContain(t)
    }
  })

  it('cancels after confirmation', async () => {
    routeApi(api, { 'GET /api/v1/bookings/bk1': booking, 'POST /api/v1/bookings/bk1/cancel': { ok: true } })
    const { default: Detail } = await import('@/app/booking/[id]')
    const s = await renderScreen(<Detail />)
    await s.press('Cancel Appointment')
    expect(alertButtons(alert).map((b) => b.text)).toEqual(['Keep', 'Cancel Booking'])
    await pressAlertButton(alert, 'Cancel Booking')
    expect(sent(api, 'POST /api/v1/bookings/bk1/cancel')).toHaveLength(1)
    expect(s.text()).toContain('cancelled')
    expect(s.hasButton('Cancel Appointment')).toBe(false)
  })

  it('alerts when cancelling fails', async () => {
    routeApi(api, { 'GET /api/v1/bookings/bk1': booking, 'POST /api/v1/bookings/bk1/cancel': new ApiError(400, 'This booking can no longer be cancelled.') })
    const { default: Detail } = await import('@/app/booking/[id]')
    const s = await renderScreen(<Detail />)
    await s.press('Cancel Appointment')
    await pressAlertButton(alert, 'Cancel Booking')
    expect(alert).toHaveBeenLastCalledWith('Error', 'This booking can no longer be cancelled.')
  })

  it('hides cancel for finished bookings and handles missing ones', async () => {
    routeApi(api, { 'GET /api/v1/bookings/bk1': { ...booking, status: 'completed', discountAmount: 0, notes: undefined } })
    const { default: Detail } = await import('@/app/booking/[id]')
    const s = await renderScreen(<Detail />)
    expect(s.hasButton('Cancel Appointment')).toBe(false)
    expect(s.text()).not.toContain('Discount')

    setParams({ id: 'missing' })
    routeApi(api, {})
    expect((await renderScreen(<Detail />)).text()).toBe('Booking not found')
  })
})
