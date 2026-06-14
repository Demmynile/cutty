import * as SecureStore from 'expo-secure-store'
import { writeClient } from './sanity'

const TOKEN_KEY = 'cutty_auth_token'
const USER_KEY = 'cutty_user_id'

export async function storeAuthData(token: string, userId: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token)
  await SecureStore.setItemAsync(USER_KEY, userId)
}

export async function getAuthData() {
  const token = await SecureStore.getItemAsync(TOKEN_KEY)
  const userId = await SecureStore.getItemAsync(USER_KEY)
  return { token, userId }
}

export async function clearAuthData() {
  await SecureStore.deleteItemAsync(TOKEN_KEY)
  await SecureStore.deleteItemAsync(USER_KEY)
}

export async function createCustomerInSanity(uid: string, fullName: string, email: string, phone?: string) {
  return await writeClient.create({
    _type: 'customer',
    uid,
    fullName,
    email,
    phone,
    walletBalance: 0,
    loyaltyPoints: 0,
    totalVisits: 0,
    tier: 'bronze',
    isActive: true,
    createdAt: new Date().toISOString(),
  })
}

export async function generateOrderNumber(): Promise<string> {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 5).toUpperCase()
  return `CUT-${timestamp}-${random}`
}
