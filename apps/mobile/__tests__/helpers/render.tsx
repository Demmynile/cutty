import { act } from 'react'
import { createRoot } from 'react-dom/client'

// Runs a hook inside a real React 19 root (tests using it opt into
// `// @vitest-environment jsdom`). `result.current` tracks the latest value.

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

export async function renderHook<T, P = undefined>(hook: (props: P) => T, initialProps?: P) {
  const result = { current: undefined as T }
  let props = initialProps as P
  function Probe() {
    result.current = hook(props)
    return null
  }
  const root = createRoot(document.createElement('div'))
  await act(async () => root.render(<Probe />))
  return {
    result,
    rerender: async (next: P) => {
      props = next
      await act(async () => root.render(<Probe />))
    },
    unmount: () => act(async () => root.unmount()),
  }
}

export { act }
