import { useCallback, useEffect } from 'react'
import { Linking, Platform } from 'react-native'
import * as Location from 'expo-location'
import { create } from 'zustand'

export type LatLng = { lat: number; lng: number }

/** Map centre before we know where the customer is (Lagos Island). */
export const DEFAULT_CENTER: LatLng = { lat: 6.4541, lng: 3.3947 }

type Permission = 'unknown' | 'granted' | 'denied'

// One shared fix for every screen, so Home and the map never ask twice.
const useLocationStore = create<{ position: LatLng | null; permission: Permission; locating: boolean }>(() => ({
  position: null,
  permission: 'unknown',
  locating: false,
}))

async function locate(prompt: boolean) {
  const store = useLocationStore
  if (store.getState().locating) return
  store.setState({ locating: true })
  try {
    let { status } = await Location.getForegroundPermissionsAsync()
    if (status !== 'granted' && prompt) status = (await Location.requestForegroundPermissionsAsync()).status
    if (status !== 'granted') {
      store.setState({ permission: status === 'denied' ? 'denied' : 'unknown' })
      return
    }
    store.setState({ permission: 'granted' })
    // A recent cached fix shows pins instantly; the fresh one refines it.
    const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 })
    if (last) store.setState({ position: { lat: last.coords.latitude, lng: last.coords.longitude } })
    const now = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
    store.setState({ position: { lat: now.coords.latitude, lng: now.coords.longitude } })
  } catch {
    // Location services off or timed out: screens fall back to DEFAULT_CENTER.
  } finally {
    store.setState({ locating: false })
  }
}

/**
 * The customer's position. `prompt` asks for permission on mount (the map);
 * without it we only read a position the customer has already allowed (Home).
 */
export function useMyLocation({ prompt = false } = {}) {
  const state = useLocationStore()
  useEffect(() => {
    if (!useLocationStore.getState().position) locate(prompt)
  }, [prompt])
  const refresh = useCallback(() => {
    if (useLocationStore.getState().permission === 'denied') Linking.openSettings()
    else locate(true)
  }, [])
  return { ...state, refresh }
}

/** Rough drive time across a busy city (~20 km/h door to door). */
export function etaMinutes(km: number) {
  return Math.max(2, Math.round((km / 20) * 60))
}

export function formatDistance(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`
}

/** Opens turn-by-turn directions in the phone's maps app. */
export function openDirections(to: LatLng, label: string) {
  const q = encodeURIComponent(label)
  const url = Platform.OS === 'ios'
    ? `http://maps.apple.com/?daddr=${to.lat},${to.lng}&q=${q}`
    : `geo:0,0?q=${to.lat},${to.lng}(${q})`
  Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lng}`))
}

/** The address parts a stylist's work location can carry (see StylistLocation). */
export type AddressParts = { address?: string; area?: string; city?: string; state?: string; postcode?: string }

function partsFrom(r: Location.LocationGeocodedAddress): AddressParts {
  const street = [r.streetNumber, r.street].filter(Boolean).join(' ') || r.name || undefined
  return {
    address: street,
    area: r.district || r.subregion || undefined,
    city: r.city || undefined,
    state: r.region || undefined,
    postcode: r.postalCode || undefined,
  }
}

/** Best-effort address for a pin (reverse geocode). Empty when the lookup fails. */
export async function addressAt(p: LatLng): Promise<AddressParts> {
  try {
    const [r] = await Location.reverseGeocodeAsync({ latitude: p.lat, longitude: p.lng })
    return r ? partsFrom(r) : {}
  } catch {
    return {}
  }
}

/**
 * Finds a postcode or typed address (forward geocode) and fills in the rest of
 * the address from the match. Returns null when nothing matches.
 */
export async function findAddress(query: string): Promise<(LatLng & AddressParts) | null> {
  const q = query.trim()
  if (!q) return null
  try {
    const [hit] = await Location.geocodeAsync(q)
    if (!hit) return null
    const point = { lat: hit.latitude, lng: hit.longitude }
    return { ...point, ...(await addressAt(point)) }
  } catch {
    return null
  }
}
