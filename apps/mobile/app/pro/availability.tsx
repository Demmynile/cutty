import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { WEEKDAYS, type AvailabilityWindow, type StylistAccount, type Weekday } from '@cutty/types'
import { api, errorMessage } from '@/lib/api'
import { invalidate, keys } from '@/lib/data'
import { useAuthStore } from '@/store/authStore'
import { Loading, PrimaryButton, ScreenHeader } from '@/components/ui'

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3))
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

function TimeStepper({ label, value, onChange, min, max }: { label: string; value: string; onChange: (v: string) => void; min: number; max: number }) {
  const m = toMin(value)
  return (
    <View className="flex-row items-center gap-2">
      <Text className="text-dark-400 text-xs w-9">{label}</Text>
      <TouchableOpacity accessibilityLabel={`${label} 30 minutes earlier`} disabled={m - 30 < min} onPress={() => onChange(toTime(m - 30))} className="w-8 h-8 rounded-full bg-dark-700 items-center justify-center">
        <Ionicons name="remove" size={14} color={m - 30 < min ? '#484848' : '#C8C8C8'} />
      </TouchableOpacity>
      <Text className="text-fg font-semibold w-12 text-center" style={{ fontVariant: ['tabular-nums'] }}>{value}</Text>
      <TouchableOpacity accessibilityLabel={`${label} 30 minutes later`} disabled={m + 30 > max} onPress={() => onChange(toTime(m + 30))} className="w-8 h-8 rounded-full bg-dark-700 items-center justify-center">
        <Ionicons name="add" size={14} color={m + 30 > max ? '#484848' : '#C8C8C8'} />
      </TouchableOpacity>
    </View>
  )
}

// One working window per day (most stylists work one block). Days off are
// picked from the next 60 days. Saving re-syncs the bookable profile, and new
// bookings are checked against these hours on the server.
export default function AvailabilityScreen() {
  const { stylist, setStylist } = useAuthStore()
  const [windows, setWindows] = useState<Partial<Record<Weekday, AvailabilityWindow>>>(() =>
    Object.fromEntries((stylist?.weeklyAvailability ?? []).map((w) => [w.day, w])),
  )
  const [timeOff, setTimeOff] = useState<string[]>(stylist?.timeOff ?? [])
  const [saving, setSaving] = useState(false)

  if (!stylist) return <Loading />

  const days = Array.from({ length: 60 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return d.toISOString().slice(0, 10)
  })

  function setDay(day: Weekday, on: boolean) {
    setWindows((w) => ({ ...w, [day]: on ? { day, start: '09:00', end: '18:00' } : undefined }))
  }

  function copyToWeekdays(from: Weekday) {
    const src = windows[from]
    if (!src) return
    setWindows((w) => {
      const next = { ...w }
      for (const d of WEEKDAYS) if (d !== 'saturday' && d !== 'sunday') next[d] = { day: d, start: src.start, end: src.end }
      return next
    })
  }

  async function save() {
    setSaving(true)
    try {
      const updated = await api<StylistAccount>('PUT', '/api/v1/pro/availability', {
        weeklyAvailability: WEEKDAYS.map((d) => windows[d]).filter(Boolean).map((w) => ({ day: w!.day, start: w!.start, end: w!.end })),
        timeOff: timeOff.filter((d) => d >= days[0]),
      })
      setStylist(updated)
      invalidate(keys.pro.me, keys.stylists)
      router.back()
    } catch (err) {
      Alert.alert('Not saved', errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <View className="flex-1 bg-dark-900">
      <ScreenHeader title="Availability" subtitle="When customers can book you (Lagos time)" />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 }}>
        {WEEKDAYS.map((day) => {
          const w = windows[day]
          return (
            <View key={day} className="bg-dark-800 rounded-2xl p-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-fg font-semibold capitalize">{day}</Text>
                <View className="flex-row items-center gap-3">
                  {w && day === 'monday' && (
                    <TouchableOpacity onPress={() => copyToWeekdays('monday')} hitSlop={8}>
                      <Text className="text-primary-400 text-xs">Copy to Mon–Fri</Text>
                    </TouchableOpacity>
                  )}
                  <Switch value={!!w} onValueChange={(on) => setDay(day, on)} trackColor={{ true: '#D4891A', false: '#484848' }} accessibilityLabel={`Work on ${day}`} />
                </View>
              </View>
              {w ? (
                <View className="flex-row justify-between mt-3">
                  <TimeStepper label="From" value={w.start} min={5 * 60} max={toMin(w.end) - 30} onChange={(start) => setWindows((x) => ({ ...x, [day]: { ...w, start } }))} />
                  <TimeStepper label="To" value={w.end} min={toMin(w.start) + 30} max={23 * 60 + 30} onChange={(end) => setWindows((x) => ({ ...x, [day]: { ...w, end } }))} />
                </View>
              ) : (
                <Text className="text-dark-400 text-xs mt-1">Not working</Text>
              )}
            </View>
          )
        })}

        <View className="mt-2">
          <Text className="text-fg font-bold text-base mb-1">Days off</Text>
          <Text className="text-dark-400 text-xs mb-3">Tap dates you won't be working (holidays, travel). {timeOff.length ? `${timeOff.length} selected.` : ''}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {days.map((d) => {
              const on = timeOff.includes(d)
              const date = new Date(`${d}T12:00:00`)
              return (
                <TouchableOpacity
                  key={d}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => setTimeOff(on ? timeOff.filter((x) => x !== d) : [...timeOff, d])}
                  className={`w-14 py-2.5 rounded-xl items-center border ${on ? 'bg-red-500/20 border-red-500/50' : 'bg-dark-800 border-dark-700'}`}
                >
                  <Text className={`text-xs ${on ? 'text-red-300' : 'text-dark-400'}`}>{date.toLocaleDateString('en', { weekday: 'short' })}</Text>
                  <Text className={`text-lg font-bold ${on ? 'text-red-300' : 'text-fg'}`}>{date.getDate()}</Text>
                  <Text className={`text-xs ${on ? 'text-red-300' : 'text-dark-400'}`}>{date.toLocaleDateString('en', { month: 'short' })}</Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </View>

        <View className="mt-4"><PrimaryButton label="Save availability" onPress={save} loading={saving} /></View>
      </ScrollView>
    </View>
  )
}
