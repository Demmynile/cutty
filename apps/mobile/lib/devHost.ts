import Constants from 'expo-constants'

// In development the API and chat servers run on the same machine as Metro.
// When .env points at a LAN/local address, swap in the host Expo actually
// loaded the app from, so a changed Wi-Fi IP doesn't break the connection.
// Production builds (and non-local URLs) are used exactly as configured.
const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/

export function resolveDevUrl(url: string | undefined): string | undefined {
  if (!__DEV__ || !url) return url
  const devHost = Constants.expoConfig?.hostUri?.split(':')[0]
  if (!devHost) return url
  try {
    const parsed = new URL(url)
    if (!PRIVATE_HOST.test(parsed.hostname)) return url
    return `${parsed.protocol}//${devHost}${parsed.port ? `:${parsed.port}` : ''}`
  } catch {
    return url
  }
}
