import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach } from 'vitest'
import { QueryClientProvider, notifyManager } from '@tanstack/react-query'
import { queryClient } from '@/lib/data'

// Renders a screen through the react-native DOM shim (stubs/react-native.tsx)
// and offers a few user-level queries. Test files using it declare
// `// @vitest-environment jsdom`.

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()

// Screens left mounted would keep reacting to shared stores (and calling the
// next test's mocked API), so every screen is unmounted after each test.
// Screens use the app's real query client, without retries (tests mock
// failures on purpose) and with the cache emptied between tests.
const mounted = new Set<Root>()
queryClient.setDefaultOptions({ queries: { retry: false, staleTime: 30_000 } })
// Notify components in a microtask (flushed by act) rather than a timer.
notifyManager.setScheduler(queueMicrotask)
afterEach(async () => {
  for (const root of mounted) await act(async () => root.unmount())
  mounted.clear()
  queryClient.clear()
  document.body.innerHTML = ''
})

// Captured before any test installs fake timers, so flushing still works then.
const realSetTimeout = globalThis.setTimeout

export async function flush() {
  for (let i = 0; i < 5; i++) await act(async () => { await new Promise((r) => realSetTimeout(r, 0)) })
}

export async function renderScreen(ui: Parameters<Root['render']>[0]) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  mounted.add(root)
  await act(async () => root.render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>))
  await flush()

  const all = <T extends Element>(sel: string) => [...container.querySelectorAll<T>(sel)]

  const screen = {
    container,
    text: () => norm(container.textContent),
    has: (t: string | RegExp) => (typeof t === 'string' ? norm(container.textContent).includes(t) : t.test(norm(container.textContent))),
    /** The innermost button (pressable) whose text includes `label`. */
    button(label: string | RegExp) {
      const match = (el: Element) => (typeof label === 'string' ? norm(el.textContent).includes(label) : label.test(norm(el.textContent)))
      const found = all<HTMLButtonElement>('button').filter(match)
      const innermost = found.filter((b) => !found.some((o) => o !== b && b.contains(o)))
      if (!innermost.length) throw new Error(`No button matching ${label}. Buttons: ${all('button').map((b) => JSON.stringify(norm(b.textContent))).join(', ')}`)
      return innermost[0]
    },
    hasButton: (label: string | RegExp) => {
      try { screen.button(label); return true } catch { return false }
    },
    /** The button containing an Ionicon with this name. */
    iconButton(icon: string) {
      const el = container.querySelector(`i[data-icon="${icon}"]`)?.closest('button')
      if (!el) throw new Error(`No button with icon ${icon}`)
      return el
    },
    input(placeholder: string | RegExp) {
      const el = all<HTMLInputElement>('input, textarea').find((i) =>
        typeof placeholder === 'string' ? (i.placeholder ?? '').includes(placeholder) : placeholder.test(i.placeholder ?? ''),
      )
      if (!el) throw new Error(`No input with placeholder ${placeholder}. Inputs: ${all<HTMLInputElement>('input, textarea').map((i) => i.placeholder).join(', ')}`)
      return el
    },
    inputs: () => all<HTMLInputElement>('input:not([type=checkbox]), textarea'),
    switches: () => all<HTMLInputElement>('input[role=switch]'),
    images: () => all<HTMLImageElement>('img').map((i) => i.getAttribute('src')),
    redirect: () => container.querySelector('[data-redirect]')?.getAttribute('data-redirect') ?? null,
    async press(target: Element | string | RegExp) {
      const el = typeof target === 'string' || target instanceof RegExp ? screen.button(target) : target
      await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
      await flush()
    },
    async type(target: HTMLInputElement | string | RegExp, value: string) {
      const el = typeof target === 'string' || target instanceof RegExp ? screen.input(target) : target
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
      await act(async () => {
        Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value)
        el.dispatchEvent(new Event('input', { bubbles: true }))
      })
      await flush()
    },
    unmount: async () => {
      mounted.delete(root)
      await act(async () => root.unmount())
    },
  }
  return screen
}

/** The buttons passed to the most recent Alert.alert call. */
export function alertButtons(alert: { mock: { calls: unknown[][] } }) {
  const call = alert.mock.calls.at(-1)
  return (call?.[2] ?? []) as Array<{ text: string; style?: string; onPress?: () => unknown }>
}

export async function pressAlertButton(alert: { mock: { calls: unknown[][] } }, text: string) {
  const b = alertButtons(alert).find((x) => x.text === text)
  if (!b) throw new Error(`No alert button "${text}"`)
  await act(async () => { await b.onPress?.() })
  await flush()
}
