import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import type { StylistSale } from '@cutty/types'
import { api, errorMessage } from '@/lib/api'
import { imageUri } from '@/lib/sanity'
import { invalidate, keys, useProProducts, useProSales, usePullToRefresh, useRefetchOnFocus } from '@/lib/data'
import { useAuthStore } from '@/store/authStore'
import { useFormatPrice } from '@/lib/currency'
import { Banner, Card, Chip, EmptyState, Loading, SecondaryButton, StatusPill } from '@/components/ui'
import { withShop } from '@/lib/features'

type SaleAction = 'confirm_payment' | 'accept' | 'ship' | 'deliver' | 'cancel'

function actionsFor(sale: StylistSale): Array<{ action: SaleAction; label: string; tone?: 'gold' | 'danger' }> {
  switch (sale.status) {
    case 'pending':
      return sale.paymentMethod === 'transfer'
        ? [{ action: 'confirm_payment', label: 'Payment received', tone: 'gold' }, { action: 'cancel', label: 'Cancel', tone: 'danger' }]
        : []
    case 'paid': return [{ action: 'accept', label: 'Accept order', tone: 'gold' }]
    case 'processing': return [{ action: 'ship', label: 'Mark shipped', tone: 'gold' }]
    case 'shipped': return [{ action: 'deliver', label: 'Mark delivered', tone: 'gold' }]
    default: return []
  }
}

function ProShopScreen() {
  const formatPrice = useFormatPrice()
  const stylist = useAuthStore((s) => s.stylist)
  const [tab, setTab] = useState<'sales' | 'products'>('sales')
  const [salesFilter, setSalesFilter] = useState<'open' | 'all'>('open')
  const shopOpen = stylist?.shop.status === 'approved'
  const salesQ = useProSales(shopOpen)
  const productsQ = useProProducts(shopOpen)
  const sales = salesQ.data ?? null
  const products = productsQ.data ?? null
  const { refreshing, onRefresh } = usePullToRefresh(salesQ.refetch, productsQ.refetch)
  useRefetchOnFocus(onRefresh)

  async function act(sale: StylistSale, action: SaleAction, label: string) {
    const go = async () => {
      try {
        await api('POST', `/api/v1/pro/sales/${sale._id}`, { action })
        await invalidate(keys.pro.sales, keys.pro.dashboard, keys.pro.customers)
      } catch (err) {
        Alert.alert('Not updated', errorMessage(err))
      }
    }
    const confirmText: Partial<Record<SaleAction, string>> = {
      confirm_payment: `Confirm you received ${formatPrice(sale.totalAmount)} from ${sale.customerName}? Only confirm once the money is in your account.`,
      cancel: `Cancel order #${sale.orderNumber}?`,
    }
    if (confirmText[action]) {
      Alert.alert(label, confirmText[action], [{ text: 'Back', style: 'cancel' }, { text: label, style: action === 'cancel' ? 'destructive' : 'default', onPress: go }])
    } else {
      go()
    }
  }

  if (!stylist) return <Loading />

  if (!shopOpen) {
    const s = stylist.shop.status
    return (
      <View className="flex-1 bg-dark-900">
        <View className="px-5 pt-14 pb-4 bg-dark-800"><Text className="text-fg text-2xl font-bold">Shop</Text></View>
        <View className="p-5 gap-4">
          {stylist.status !== 'approved' && <Banner tone="warning" title="Shops open after profile approval" body="Once Cutty approves your profile you can apply for a shop." />}
          {stylist.status === 'approved' && s === 'none' && (
            <EmptyState icon="storefront-outline" title="Sell to your customers" body="List hair and grooming products. Card payments split automatically: your share goes to your bank, Cutty keeps a small commission." action={{ label: 'Set up my shop', onPress: () => router.push('/pro/shop-setup') }} />
          )}
          {s === 'requested' && <Banner tone="warning" title="Shop under review" body={`We're checking ${stylist.shop.name ?? 'your shop'} and your payout account (${stylist.shop.bankName} ••••${stylist.shop.accountNumberLast4}).`} />}
          {s === 'rejected' && <Banner tone="danger" title="Shop not approved" body={stylist.shop.reviewNote || 'Update your details and apply again.'} action={{ label: 'Update and reapply', onPress: () => router.push('/pro/shop-setup') }} />}
          {s === 'suspended' && <Banner tone="danger" title="Shop suspended" body={stylist.shop.reviewNote || 'Contact Cutty support to reopen your shop.'} />}
        </View>
      </View>
    )
  }

  const visibleSales = (sales ?? []).filter((x) => salesFilter === 'all' || ['pending', 'paid', 'processing', 'shipped'].includes(x.status))

  return (
    <View className="flex-1 bg-dark-900">
      <View className="px-5 pt-14 pb-4 bg-dark-800">
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-fg text-2xl font-bold">{stylist.shop.name ?? 'My shop'}</Text>
            <Text className="text-dark-400 text-xs mt-0.5">Cutty commission {stylist.shop.commissionPercent ?? 10}% · paid to {stylist.shop.bankName} ••••{stylist.shop.accountNumberLast4}</Text>
          </View>
          {tab === 'products' && (
            <TouchableOpacity className="bg-primary-500 px-4 py-2 rounded-xl flex-row items-center gap-1" onPress={() => router.push('/pro/product-edit')}>
              <Ionicons name="add" size={16} color="#111111" />
              <Text className="font-semibold" style={{ color: '#111111' }}>Add</Text>
            </TouchableOpacity>
          )}
        </View>
        <View className="flex-row gap-2">
          <Chip label={`Sales${sales ? ` (${sales.filter((x) => x.status === 'pending' || x.status === 'paid').length})` : ''}`} selected={tab === 'sales'} onPress={() => setTab('sales')} />
          <Chip label={`Products${products ? ` (${products.length})` : ''}`} selected={tab === 'products'} onPress={() => setTab('products')} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor="#D4891A" onRefresh={onRefresh} />}
      >
        {tab === 'sales' && (
          <>
            <View className="flex-row gap-2">
              <Chip label="Open" selected={salesFilter === 'open'} onPress={() => setSalesFilter('open')} />
              <Chip label="All" selected={salesFilter === 'all'} onPress={() => setSalesFilter('all')} />
            </View>
            {sales === null && <Loading />}
            {sales && visibleSales.length === 0 && <EmptyState icon="receipt-outline" title="No sales to handle" body="New orders for your products show up here." />}
            {visibleSales.map((sale) => (
              <Card key={sale._id}>
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    <Text className="text-fg font-bold">#{sale.orderNumber}</Text>
                    <Text className="text-dark-400 text-xs mt-0.5">{sale.customerName} · {new Date(sale.createdAt).toLocaleDateString()} · {sale.paymentMethod === 'transfer' ? 'Bank transfer to you' : 'Card (Paystack)'}</Text>
                  </View>
                  <StatusPill status={sale.status} />
                </View>
                <View className="mt-3 gap-1">
                  {sale.items.map((i, idx) => (
                    <View key={idx} className="flex-row justify-between">
                      <Text className="text-dark-300 text-sm flex-1" numberOfLines={1}>{i.productName} ×{i.quantity}</Text>
                      <Text className="text-fg text-sm">{formatPrice(i.priceAtOrder * i.quantity)}</Text>
                    </View>
                  ))}
                  <View className="flex-row justify-between pt-2 mt-1 border-t border-dark-700">
                    <Text className="text-fg font-semibold">Total</Text>
                    <Text className="text-primary-400 font-bold">{formatPrice(sale.totalAmount)}</Text>
                  </View>
                </View>
                {sale.shippingAddress && (
                  <Text className="text-dark-400 text-xs mt-2">Deliver to {sale.shippingAddress.fullName}, {sale.shippingAddress.address}, {sale.shippingAddress.city} · {sale.shippingAddress.phone}</Text>
                )}
                {actionsFor(sale).length > 0 && (
                  <View className="flex-row flex-wrap gap-2 mt-3 pt-3 border-t border-dark-700">
                    {actionsFor(sale).map((a) => <SecondaryButton key={a.action} small label={a.label} tone={a.tone} onPress={() => act(sale, a.action, a.label)} />)}
                  </View>
                )}
              </Card>
            ))}
          </>
        )}

        {tab === 'products' && (
          <>
            {products === null && <Loading />}
            {products && products.length === 0 && <EmptyState icon="pricetags-outline" title="No products yet" body="Add your first product to start selling." action={{ label: 'Add product', onPress: () => router.push('/pro/product-edit') }} />}
            {(products ?? []).map((p) => (
              <TouchableOpacity key={p._id} onPress={() => router.push(`/pro/product-edit?id=${p._id}`)} className="bg-dark-800 rounded-2xl p-3 flex-row gap-3 items-center">
                <View className="w-16 h-16 rounded-xl bg-dark-700 overflow-hidden items-center justify-center">
                  {p.images?.[0] ? <Image source={{ uri: imageUri(p.images[0], 128, 128) }} style={{ width: 64, height: 64 }} contentFit="cover" /> : <Ionicons name="image-outline" size={22} color="#686868" />}
                </View>
                <View className="flex-1">
                  <Text className="text-fg font-semibold" numberOfLines={1}>{p.name}</Text>
                  <Text className="text-primary-400 font-bold mt-0.5">{formatPrice(p.price)}</Text>
                  <Text className={`text-xs mt-0.5 ${p.stock === 0 ? 'text-red-400' : p.stock <= 5 ? 'text-yellow-400' : 'text-dark-400'}`}>
                    {p.isActive === false ? 'Hidden' : p.stock === 0 ? 'Out of stock' : `${p.stock} in stock`}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#686868" />
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  )
}

// Hidden until the shop launches (v2.0).
export default withShop(ProShopScreen)
