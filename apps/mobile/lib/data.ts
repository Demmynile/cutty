import { useCallback, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { QueryClient, focusManager, useQuery, type QueryKey } from '@tanstack/react-query'
import { useFocusEffect } from 'expo-router'
import type {
  AISearchResult, BankOption, Booking, Category, ChatMessageDoc, ConversationSummary, LoyaltyTransaction,
  Order, Product, StylistAccount, StylistCustomerStat, StylistDashboard, StylistPublic, StylistSale, WalletTransaction,
} from '@cutty/types'
import { api, isTransientError } from './api'

// One cache for every API read in the app. Screens that show the same data
// share one request; going back to a screen shows the cached copy instantly
// and refreshes it in the background. Writes go through `api()` and then
// call `invalidate(...)` so every screen showing that data updates.

const MINUTE = 60_000

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 30 * MINUTE,
        // Only retry what retrying can fix (offline, server starting, rate limit).
        retry: (failures, err) => failures < 2 && isTransientError(err),
      },
    },
  })
}

export const queryClient = createQueryClient()

// Coming back to the app counts as focus: stale queries on screen refetch.
focusManager.setEventListener((setFocused) => {
  const sub = AppState.addEventListener('change', (state) => setFocused(state === 'active'))
  return () => sub.remove()
})

/** Query keys, in one place so reads and invalidations always agree. */
export const keys = {
  categories: ['catalog', 'categories'],
  products: ['catalog', 'products'],
  featuredProducts: ['catalog', 'products', 'featured'],
  product: (slug: string) => ['catalog', 'products', slug],
  stylists: ['stylists'],
  stylist: (id: string) => ['stylists', id],
  nearbyStylists: (lat: number, lng: number) => ['stylists', 'near', lat, lng],
  availability: (barberId: string, date: string, duration: number) => ['availability', barberId, date, duration],
  me: ['me'],
  bookings: ['bookings'],
  booking: (id: string) => ['bookings', id],
  orders: ['orders'],
  wallet: ['wallet', 'transactions'],
  loyalty: ['loyalty', 'transactions'],
  recommendations: ['recommendations'],
  conversations: ['conversations'],
  messages: (base: string) => ['messages', base],
  pro: {
    all: ['pro'],
    me: ['pro', 'me'],
    dashboard: ['pro', 'dashboard'],
    products: ['pro', 'products'],
    bookings: (status: string) => ['pro', 'bookings', status],
    sales: ['pro', 'sales'],
    customers: ['pro', 'customers'],
    banks: ['pro', 'banks'],
  },
} as const

/** Marks data stale everywhere it's shown, refetching what's on screen. */
export function invalidate(...queryKeys: QueryKey[]) {
  return Promise.all(queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
}

const get = <T>(path: string) => () => api<T>('GET', path)

// Shop catalogue: changes rarely, so it stays fresh for 5 minutes.
const CATALOG = { staleTime: 5 * MINUTE }

export const useCategories = () => useQuery({ queryKey: keys.categories, queryFn: get<Category[]>('/api/v1/catalog/categories'), ...CATALOG })
export const useProducts = () => useQuery({ queryKey: keys.products, queryFn: get<Product[]>('/api/v1/catalog/products'), ...CATALOG })
export const useFeaturedProducts = (enabled = true) =>
  useQuery({ queryKey: keys.featuredProducts, queryFn: get<Product[]>('/api/v1/catalog/products?featured=1'), ...CATALOG, enabled })
export const useProduct = (slug: string) =>
  useQuery({ queryKey: keys.product(slug), queryFn: get<Product>(`/api/v1/catalog/products/${encodeURIComponent(slug)}`), ...CATALOG })

export const useStylists = () => useQuery({ queryKey: keys.stylists, queryFn: get<StylistPublic[]>('/api/v1/stylists'), ...CATALOG })
/** Stylists sorted nearest first, each with `distanceKm`. Rounds the position (~100 m) so small GPS jitter reuses the cache. */
export const useNearbyStylists = (pos: { lat: number; lng: number } | null) => {
  const lat = pos ? Math.round(pos.lat * 1000) / 1000 : 0
  const lng = pos ? Math.round(pos.lng * 1000) / 1000 : 0
  return useQuery({
    queryKey: keys.nearbyStylists(lat, lng),
    queryFn: get<StylistPublic[]>(`/api/v1/stylists?lat=${lat}&lng=${lng}`),
    enabled: !!pos,
    staleTime: MINUTE,
  })
}
export const useStylist = (id: string | undefined) =>
  useQuery({ queryKey: keys.stylist(id ?? ''), queryFn: get<StylistPublic>(`/api/v1/stylists/${id}`), enabled: !!id, ...CATALOG })

/** Free start times; never cached as fresh, since another customer may book a slot. */
export const useAvailability = (barberId: string | undefined, date: string | null, duration: number) =>
  useQuery({
    queryKey: keys.availability(barberId ?? '', date ?? '', duration),
    queryFn: async () => (await api<{ slots: string[] }>('GET', `/api/v1/availability?barberId=${barberId}&date=${date}&duration=${duration}`)).slots,
    enabled: !!barberId && !!date,
    staleTime: 0,
  })

// The signed-in customer's own data.
export const useBookings = () => useQuery({ queryKey: keys.bookings, queryFn: get<Booking[]>('/api/v1/bookings') })
export const useBooking = (id: string) =>
  useQuery({ queryKey: keys.booking(id), queryFn: get<Booking>(`/api/v1/bookings/${encodeURIComponent(id)}`) })
export const useOrders = () => useQuery({ queryKey: keys.orders, queryFn: get<Order[]>('/api/v1/orders') })
export const useWalletTransactions = () => useQuery({ queryKey: keys.wallet, queryFn: get<WalletTransaction[]>('/api/v1/wallet/transactions') })
export const useLoyaltyTransactions = () => useQuery({ queryKey: keys.loyalty, queryFn: get<LoyaltyTransaction[]>('/api/v1/loyalty/transactions') })
export const useRecommendations = () =>
  useQuery({ queryKey: keys.recommendations, queryFn: get<AISearchResult & { personalized: boolean }>('/api/v1/recommendations') })
export const useConversations = (as: 'customer' | 'stylist') =>
  useQuery({
    queryKey: as === 'customer' ? keys.conversations : [...keys.pro.all, 'conversations'],
    queryFn: get<ConversationSummary[]>(as === 'customer' ? '/api/v1/conversations' : '/api/v1/pro/conversations'),
  })

/** API base for one chat thread, for the signed-in role. */
export const threadBase = (role: 'customer' | 'stylist', conversationId: string) =>
  role === 'stylist' ? `/api/v1/pro/conversations/${conversationId}` : `/api/v1/conversations/${conversationId}`

/**
 * A thread's newest 50 messages. Always refetched on open (staleTime 0), but
 * the cached copy shows instantly meanwhile. Loading it marks the thread read,
 * so only prefetch it when the user is actually opening the thread.
 */
export const messagesQuery = (base: string) => ({
  queryKey: keys.messages(base),
  queryFn: get<ChatMessageDoc[]>(`${base}/messages`),
  staleTime: 0,
})

/** Starts loading a thread while the chat screen animates in; the screen reuses the request. */
export function prefetchThread(role: 'customer' | 'stylist', conversationId: string) {
  queryClient.prefetchQuery(messagesQuery(threadBase(role, conversationId)))
}

// Cutty Pro (stylist) data.
export const useProMe = () => useQuery({ queryKey: keys.pro.me, queryFn: get<StylistAccount>('/api/v1/pro/me') })
export const useProDashboard = () => useQuery({ queryKey: keys.pro.dashboard, queryFn: get<StylistDashboard>('/api/v1/pro/dashboard') })
export const useProProducts = (enabled = true) =>
  useQuery({ queryKey: keys.pro.products, queryFn: get<Product[]>('/api/v1/pro/products'), enabled })
export const useProSales = (enabled = true) =>
  useQuery({ queryKey: keys.pro.sales, queryFn: get<StylistSale[]>('/api/v1/pro/sales?status=all'), enabled })
export const useProBookings = (status: string, enabled = true) =>
  useQuery({ queryKey: keys.pro.bookings(status), queryFn: get<Booking[]>(`/api/v1/pro/bookings?status=${status}`), enabled })
export const useProCustomers = () => useQuery({ queryKey: keys.pro.customers, queryFn: get<StylistCustomerStat[]>('/api/v1/pro/customers') })
export const useBanks = () => useQuery({ queryKey: keys.pro.banks, queryFn: get<BankOption[]>('/api/v1/pro/banks'), staleTime: 60 * MINUTE })

/**
 * Refetches stale data when a screen regains focus (e.g. coming back from an
 * edit screen). Skips the first focus, when the query has just loaded. The
 * latest `refetch` is read from a ref so the focus effect itself is stable.
 */
export function useRefetchOnFocus(refetch: () => unknown) {
  const latest = useRef(refetch)
  latest.current = refetch
  const first = useRef(true)
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false
        return
      }
      latest.current()
    }, []),
  )
}

/** Pull-to-refresh for one or more queries: spins only for the user's own pull. */
export function usePullToRefresh(...refetches: Array<() => Promise<unknown>>) {
  const [refreshing, setRefreshing] = useState(false)
  const latest = useRef(refetches)
  latest.current = refetches
  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all(latest.current.map((r) => r().catch(() => {})))
    setRefreshing(false)
  }, [])
  return { refreshing, onRefresh }
}
