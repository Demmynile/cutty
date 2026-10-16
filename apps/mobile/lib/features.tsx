import type { ComponentType } from 'react'
import { Redirect } from 'expo-router'
import { FEATURES } from '@cutty/types'

export { FEATURES }

/**
 * Wraps a shop-only screen. While the shop is off (FEATURES.shop, planned for
 * v2.0) any deep link or stale navigation lands on the home screen instead.
 */
export function withShop<P extends object>(Screen: ComponentType<P>) {
  if (FEATURES.shop) return Screen
  return function ShopDisabled() {
    return <Redirect href="/" />
  }
}
