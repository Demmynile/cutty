import { getAuthToken } from './auth'

// Single gateway from the app to the Cutty API (apps/admin). The app holds no
// database credentials: every read and write goes through here, authenticated
// with the signed-in customer's session token.
const API_URL = process.env.EXPO_PUBLIC_API_URL

const DEFAULT_TIMEOUT_MS = 30_000

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

let onUnauthorized: (() => void) | null = null

/** Registered by the auth store so an expired/revoked session signs the user out. */
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

export async function api<T>(method: Method, path: string, body?: unknown, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const token = await getAuthToken()

  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    if (!res.ok) {
      const errorBody = await res.json().catch(() => null)
      if (res.status === 401 && token) onUnauthorized?.()
      throw new ApiError(res.status, errorBody?.error ?? 'Request failed. Please try again.')
    }
    return (await res.json()) as T
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError(0, 'Request timed out, try again')
    }
    if (err instanceof ApiError) throw err
    throw new ApiError(0, 'Could not reach Cutty. Check your connection.')
  } finally {
    clearTimeout(timer)
  }
}

export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.') {
  return err instanceof ApiError ? err.message : fallback
}
