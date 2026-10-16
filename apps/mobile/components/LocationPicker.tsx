import { useEffect, useRef, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import MapView, { Marker } from 'react-native-maps'
import * as Location from 'expo-location'
import { Ionicons } from '@expo/vector-icons'
import type { StylistLocation } from '@cutty/types'
import { DEFAULT_CENTER, addressAt, findAddress, type AddressParts, type LatLng } from '@/lib/location'
import { DARK_MAP_STYLE, LIGHT_MAP_STYLE } from '@/lib/mapStyle'
import { useTheme } from '@/lib/theme'

type Mode = 'map' | 'address'

const ZOOM = { latitudeDelta: 0.01, longitudeDelta: 0.01 }
const FIELDS: Array<{ key: Exclude<keyof AddressParts, 'postcode'>; label: string; placeholder: string; max: number }> = [
  { key: 'address', label: 'Street address', placeholder: '12 Admiralty Way', max: 200 },
  { key: 'area', label: 'Area', placeholder: 'Lekki Phase 1', max: 80 },
  { key: 'city', label: 'City', placeholder: 'Lagos', max: 80 },
  { key: 'state', label: 'State', placeholder: 'Lagos State', max: 80 },
]

const pick = (l: StylistLocation | null): AddressParts =>
  ({ address: l?.address, area: l?.area, city: l?.city, state: l?.state, postcode: l?.postcode })

/**
 * Where a stylist works, picked one of two ways: drop a pin on the map (the
 * address fills in from it), or type a postcode and let it fill the address
 * and place the pin. Either way every field stays editable. Reports `null`
 * until there's a pin, since customers find stylists by distance.
 */
export function LocationPicker({ value, onChange, error, onClear }: {
  value: StylistLocation | null
  onChange: (location: StylistLocation | null) => void
  error?: string
  /** Shows a "Remove" link (profile edit); sign-up requires a location. */
  onClear?: () => void
}) {
  const { scheme } = useTheme()
  const mapRef = useRef<MapView>(null)
  const [mode, setMode] = useState<Mode>('map')
  const [point, setPoint] = useState<LatLng | null>(value ? { lat: value.lat, lng: value.lng } : null)
  const [parts, setParts] = useState<AddressParts>(() => pick(value))
  const [busy, setBusy] = useState<'gps' | 'postcode' | 'address' | null>(null)
  const [notFound, setNotFound] = useState<string | null>(null)

  // Parent sees one value: the pin plus whatever address we have.
  useEffect(() => {
    onChange(point ? { ...point, ...trimmed(parts) } : null)
  }, [point, parts])

  function moveTo(p: LatLng) {
    setPoint(p)
    mapRef.current?.animateToRegion({ latitude: p.lat, longitude: p.lng, ...ZOOM }, 300)
  }

  // A pin moved by hand: refill the address from it, keeping what the
  // geocoder can't tell us (e.g. a postcode it doesn't know).
  async function dropPin(p: LatLng) {
    moveTo(p)
    const found = await addressAt(p)
    setParts((cur) => ({ ...cur, ...defined(found) }))
  }

  async function useCurrentLocation() {
    setBusy('gps')
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Location', 'Allow location access to use where you are now, or enter your postcode instead.')
        return
      }
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      await dropPin({ lat: coords.latitude, lng: coords.longitude })
    } catch (e) {
      Alert.alert('Location', e instanceof Error ? e.message : 'Could not get your location.')
    } finally {
      setBusy(null)
    }
  }

  async function lookUp(kind: 'postcode' | 'address') {
    const query = kind === 'postcode'
      ? parts.postcode ?? ''
      : [parts.address, parts.area, parts.city, parts.state, parts.postcode].filter(Boolean).join(', ')
    if (!query.trim()) return
    setBusy(kind)
    setNotFound(null)
    const found = await findAddress(query)
    setBusy(null)
    if (!found) {
      setNotFound(kind === 'postcode'
        ? "We couldn't find that postcode. Check it, or type your address below and find it on the map."
        : "We couldn't find that address. Try adding the city, or drop a pin on the map instead.")
      return
    }
    moveTo({ lat: found.lat, lng: found.lng })
    // A postcode lookup fills the address; an address lookup only fills gaps.
    setParts((cur) => (kind === 'postcode'
      ? { ...cur, ...defined(found), postcode: cur.postcode }
      : { ...defined(found), ...defined(cur) }))
  }

  const set = (key: keyof AddressParts) => (text: string) => setParts((cur) => ({ ...cur, [key]: text }))
  const showFields = mode === 'address' || !!point

  return (
    <View className="gap-3">
      <View className="flex-row bg-dark-800 rounded-xl p-1" accessibilityRole="tablist">
        {([['map', 'Pin on map', 'map-outline'], ['address', 'Enter address', 'create-outline']] as const).map(([id, label, icon]) => (
          <TouchableOpacity
            key={id}
            onPress={() => { setMode(id); setNotFound(null) }}
            className={`flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-lg ${mode === id ? 'bg-primary-500' : ''}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === id }}
          >
            <Ionicons name={icon} size={15} color={mode === id ? '#111111' : '#9A9A9A'} />
            <Text className={`text-sm font-semibold ${mode === id ? '' : 'text-dark-300'}`} style={mode === id ? { color: '#111111' } : undefined}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View className={`rounded-2xl overflow-hidden border ${error ? 'border-red-500' : 'border-dark-700'}`}>
        <MapView
          ref={mapRef}
          style={{ height: mode === 'map' ? 220 : 120 }}
          initialRegion={{ latitude: point?.lat ?? DEFAULT_CENTER.lat, longitude: point?.lng ?? DEFAULT_CENTER.lng, ...(point ? ZOOM : { latitudeDelta: 0.15, longitudeDelta: 0.15 }) }}
          customMapStyle={scheme === 'dark' ? DARK_MAP_STYLE : LIGHT_MAP_STYLE}
          userInterfaceStyle={scheme}
          // The address tab only previews the pin; it's moved on the map tab.
          scrollEnabled={mode === 'map'}
          zoomEnabled={mode === 'map'}
          rotateEnabled={false}
          pitchEnabled={false}
          toolbarEnabled={false}
          onPress={mode === 'map' ? (e) => dropPin({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude }) : undefined}
        >
          {point && (
            <Marker
              coordinate={{ latitude: point.lat, longitude: point.lng }}
              draggable={mode === 'map'}
              pinColor="#D4891A"
              onDragEnd={(e) => dropPin({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })}
            />
          )}
        </MapView>
        {mode === 'map' && (
          <View className="bg-dark-800 px-4 py-3 flex-row items-center gap-3">
            <Text className="text-dark-400 text-xs flex-1">
              {point ? 'Drag the pin or tap the map to your exact chair.' : 'Tap the map where you work, or use where you are now.'}
            </Text>
            <TouchableOpacity onPress={useCurrentLocation} disabled={busy === 'gps'} className="flex-row items-center gap-1.5" accessibilityRole="button" hitSlop={8}>
              {busy === 'gps' ? <ActivityIndicator size="small" color="#D4891A" /> : <Ionicons name="locate" size={16} color="#D4891A" />}
              <Text className="text-primary-400 font-semibold text-sm">Use current location</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {showFields && (
        <View className="gap-3">
          <View>
            <Text className="text-dark-300 text-sm mb-2">Postcode</Text>
            <View className="flex-row gap-2">
              <TextInput
                className="flex-1 bg-dark-800 text-fg px-4 py-3 rounded-xl border border-dark-700"
                placeholder="e.g. 106104"
                placeholderTextColor="#686868"
                value={parts.postcode ?? ''}
                onChangeText={set('postcode')}
                onSubmitEditing={() => lookUp('postcode')}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="search"
                maxLength={12}
                accessibilityLabel="Postcode"
              />
              <TouchableOpacity
                onPress={() => lookUp('postcode')}
                disabled={!parts.postcode?.trim() || busy === 'postcode'}
                className={`px-4 rounded-xl items-center justify-center ${parts.postcode?.trim() ? 'bg-primary-500' : 'bg-dark-700'}`}
                accessibilityRole="button"
              >
                {busy === 'postcode' ? <ActivityIndicator size="small" color="#111111" /> : (
                  <Text className={`font-semibold ${parts.postcode?.trim() ? '' : 'text-dark-400'}`} style={parts.postcode?.trim() ? { color: '#111111' } : undefined}>Find</Text>
                )}
              </TouchableOpacity>
            </View>
            {mode === 'address' && <Text className="text-dark-400 text-xs mt-1.5">We'll fill in the rest of your address and place your pin.</Text>}
          </View>

          {notFound && <Text className="text-red-400 text-xs">{notFound}</Text>}

          {FIELDS.map((f) => (
            <View key={f.key}>
              <Text className="text-dark-300 text-sm mb-2">{f.label}</Text>
              <TextInput
                className="bg-dark-800 text-fg px-4 py-3 rounded-xl border border-dark-700"
                placeholder={f.placeholder}
                placeholderTextColor="#686868"
                value={parts[f.key] ?? ''}
                onChangeText={set(f.key)}
                maxLength={f.max}
                accessibilityLabel={f.label}
              />
            </View>
          ))}

          {mode === 'address' && (
            <TouchableOpacity
              onPress={() => lookUp('address')}
              disabled={busy === 'address'}
              className="bg-dark-800 border border-primary-500/50 rounded-xl py-3 flex-row items-center justify-center gap-2"
              accessibilityRole="button"
            >
              {busy === 'address' ? <ActivityIndicator size="small" color="#D4891A" /> : <Ionicons name="pin" size={16} color="#D4891A" />}
              <Text className="text-primary-400 font-semibold">{point ? 'Move pin to this address' : 'Find this address on the map'}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {error && <Text className="text-red-400 text-xs">{error}</Text>}
      {point && onClear && (
        <TouchableOpacity
          onPress={() => { setPoint(null); setParts({}); onClear() }}
          hitSlop={8}
          className="self-start"
          accessibilityRole="button"
        >
          <Text className="text-red-400 font-semibold text-sm">Remove location</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

/** Drops empty values so a lookup never blanks a field the stylist filled. */
function defined(p: AddressParts): AddressParts {
  return Object.fromEntries(Object.entries(p).filter(([, v]) => typeof v === 'string' && v.trim())) as AddressParts
}

function trimmed(p: AddressParts): AddressParts {
  return Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v?.trim() || undefined]).filter(([, v]) => v)) as AddressParts
}
