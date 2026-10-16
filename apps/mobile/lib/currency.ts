import { useCallback } from 'react'
import { create } from 'zustand'
import type { PreferredCurrency } from '@cutty/types'
import { api } from './api'
import { useAuthStore } from '@/store/authStore'

// Naira per 1 unit. Fallbacks for when Shop Settings has no rates configured.
// Display only — every payment is still charged in NGN.
const DEFAULT_RATES: Record<PreferredCurrency, number> = { NGN: 1, USD: 1550, GBP: 2050 }

const SYMBOLS: Record<PreferredCurrency, string> = { NGN: '₦', USD: '$', GBP: '£' }

const useRatesStore = create<{ rates: Record<PreferredCurrency, number> }>(() => ({ rates: DEFAULT_RATES }))

export async function loadExchangeRates() {
  try {
    const remote = await api<Partial<Record<PreferredCurrency, number>> | null>('GET', '/api/v1/catalog/exchange-rates')
    if (!remote) return
    const rates = { ...DEFAULT_RATES }
    for (const code of ['USD', 'GBP'] as const) {
      if (typeof remote[code] === 'number' && remote[code]! > 0) rates[code] = remote[code]!
    }
    useRatesStore.setState({ rates })
  } catch {
    // Keep the defaults.
  }
}

export function formatKobo(kobo: number, currency: PreferredCurrency, rates: Record<PreferredCurrency, number>) {
  const naira = kobo / 100
  if (currency === 'NGN') return `₦${naira.toLocaleString('en-NG')}`
  const value = naira / rates[currency]
  return `${SYMBOLS[currency]}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Price formatter in the customer's preferred currency; re-renders when it changes. */
export function useFormatPrice() {
  const currency = useAuthStore((s) => s.customer?.preferredCurrency) || 'NGN'
  const rates = useRatesStore((s) => s.rates)
  // Stable between renders, so memoized list rows don't re-render needlessly.
  return useCallback((kobo: number) => formatKobo(kobo, currency, rates), [currency, rates])
}

export function usePreferredCurrency(): PreferredCurrency {
  return useAuthStore((s) => s.customer?.preferredCurrency) || 'NGN'
}
