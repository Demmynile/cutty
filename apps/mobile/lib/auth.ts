import * as SecureStore from 'expo-secure-store'

// The session token is issued by the Cutty API (apps/admin/app/api/v1/auth/*)
// and kept in the device keychain/keystore. Passwords are verified and hashed
// on the server only — the app never sees a hash.
const TOKEN_KEY = 'cutty_auth_token'
const LEGACY_USER_KEY = 'cutty_user_id'

export async function storeAuthToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token)
}

export async function getAuthToken() {
  return SecureStore.getItemAsync(TOKEN_KEY)
}

export async function clearAuthData() {
  await SecureStore.deleteItemAsync(TOKEN_KEY)
  await SecureStore.deleteItemAsync(LEGACY_USER_KEY)
}
