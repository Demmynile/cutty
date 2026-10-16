import { createElement, useEffect, type ReactNode } from 'react'
import { vi } from 'vitest'

// Navigation is recorded, not performed. Tests set route params with
// `setParams` and inspect `router.push` etc.

export const router = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  dismiss: vi.fn(),
  dismissAll: vi.fn(),
  navigate: vi.fn(),
  canGoBack: vi.fn(() => true),
  setParams: vi.fn(),
}
export const useRouter = () => router

let params: Record<string, string> = {}
export function setParams(p: Record<string, string>) {
  params = p
}
export const useLocalSearchParams = () => params
export const useGlobalSearchParams = () => params

let segments: string[] = []
export function setSegments(s: string[]) {
  segments = s
}
export const useSegments = () => segments

// Runs the callback once after mount, like a screen gaining focus.
export function useFocusEffect(cb: () => void | (() => void)) {
  useEffect(() => cb(), [cb])
}

export const Redirect = ({ href }: { href: string }) => createElement('div', { 'data-redirect': href })
export const Link = ({ href, children }: { href: string; children: ReactNode }) => createElement('a', { href }, children)

function Navigator({ children }: { children?: ReactNode }) {
  return createElement('div', { 'data-navigator': true }, children)
}
function Screen({ name, options }: { name: string; options?: Record<string, unknown> }) {
  const title = typeof options?.title === 'string' ? options.title : undefined
  return createElement('div', { 'data-screen': name, 'data-title': title, 'data-hidden': options?.href === null ? 'true' : undefined })
}
export const Stack = Object.assign(Navigator, { Screen })
export const Tabs = Object.assign(Navigator, { Screen })
export const Slot = () => createElement('div', { 'data-slot': true })
