// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StylistLocation } from '@cutty/types'
import * as expoLocation from '../stubs/expo-location'
import { Alert } from '../stubs/react-native'
import { renderScreen } from '../helpers/screen'

const { LocationPicker } = await import('@/components/LocationPicker')

const geocode = vi.mocked(expoLocation.geocodeAsync)
const reverse = vi.mocked(expoLocation.reverseGeocodeAsync)
const field = (s: Awaited<ReturnType<typeof renderScreen>>, label: string) =>
  s.container.querySelector(`[aria-label="${label}"]`) as HTMLInputElement

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('LocationPicker', () => {
  it('fills the address and pin from a postcode, then keeps manual edits', async () => {
    const onChange = vi.fn()
    geocode.mockResolvedValue([{ latitude: 6.43, longitude: 3.47 }] as never)
    reverse.mockResolvedValue([{ name: 'The Palms', district: 'Lekki', city: 'Lagos', region: 'Lagos', postalCode: '106104' }] as never)
    const s = await renderScreen(<LocationPicker value={null} onChange={onChange} />)
    expect(onChange).toHaveBeenLastCalledWith(null)
    expect(field(s, 'Postcode')).toBeNull() // map tab shows fields once there's a pin

    await s.press('Enter address')
    await s.type('e.g. 106104', ' 106104 ')
    await s.press(/^Find$/)
    expect(geocode).toHaveBeenCalledWith('106104')
    expect(field(s, 'Street address').value).toBe('The Palms') // place name when there's no street
    expect(onChange).toHaveBeenLastCalledWith({ lat: 6.43, lng: 3.47, address: 'The Palms', area: 'Lekki', city: 'Lagos', state: 'Lagos', postcode: '106104' })

    await s.type(field(s, 'Street address'), 'Shop 4, The Palms')
    expect(onChange.mock.lastCall![0]).toMatchObject({ address: 'Shop 4, The Palms', lat: 6.43 })
  })

  it("explains when a postcode isn't found, and can find a typed address instead", async () => {
    const onChange = vi.fn()
    const s = await renderScreen(<LocationPicker value={null} onChange={onChange} />)
    await s.press('Enter address')
    await s.type('e.g. 106104', 'XX1')
    await s.press(/^Find$/)
    expect(s.text()).toContain("We couldn't find that postcode")
    expect(onChange).toHaveBeenLastCalledWith(null)

    geocode.mockResolvedValue([{ latitude: 6.5, longitude: 3.36 }] as never)
    reverse.mockResolvedValue([{ district: 'Yaba', city: 'Lagos', region: 'Lagos' }] as never)
    await s.type(field(s, 'Street address'), '5 Herbert Macaulay Way')
    await s.type(field(s, 'City'), 'Lagos')
    await s.press('Find this address on the map')
    expect(geocode).toHaveBeenLastCalledWith('5 Herbert Macaulay Way, Lagos, XX1')
    expect(s.text()).not.toContain("couldn't find")
    // What the stylist typed wins; the lookup only fills the gaps.
    expect(onChange).toHaveBeenLastCalledWith({ lat: 6.5, lng: 3.36, address: '5 Herbert Macaulay Way', area: 'Yaba', city: 'Lagos', state: 'Lagos', postcode: 'XX1' })
    expect(s.text()).toContain('Move pin to this address')
  })

  it('starts from a saved location, asks before using GPS, and can be removed', async () => {
    const onChange = vi.fn()
    const onClear = vi.fn()
    const saved: StylistLocation = { lat: 6.6, lng: 3.35, area: 'Ikeja', postcode: '100271' }
    const s = await renderScreen(<LocationPicker value={saved} onChange={onChange} onClear={onClear} />)
    expect(field(s, 'Area').value).toBe('Ikeja')
    expect(field(s, 'Postcode').value).toBe('100271')

    await s.press('Use current location') // permission denied by default
    expect(Alert.alert).toHaveBeenCalledWith('Location', expect.stringContaining('enter your postcode instead'))

    await s.press('Remove location')
    expect(onClear).toHaveBeenCalled()
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('shows the error passed by the form', async () => {
    const s = await renderScreen(<LocationPicker value={null} onChange={vi.fn()} error="Add where you work" />)
    expect(s.text()).toContain('Add where you work')
  })
})
