import { act, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'

// Minimal DOM rendering for client components (files using it opt into
// `// @vitest-environment jsdom`). Server components are awaited and rendered
// to static HTML with `renderServer`.

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

export async function render(ui: ReactElement) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => root.render(ui))
  return {
    container,
    button: (text: string) => {
      const b = [...container.querySelectorAll('button')].find((el) => el.textContent?.trim() === text)
      if (!b) throw new Error(`No button "${text}". Buttons: ${[...container.querySelectorAll('button')].map((x) => x.textContent).join(', ')}`)
      return b
    },
    buttons: () => [...container.querySelectorAll('button')].map((b) => b.textContent?.trim()),
    unmount: () => act(() => root.unmount()),
  }
}

export async function click(el: Element) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

export function renderServer(ui: ReactElement) {
  return renderToStaticMarkup(ui)
}

/** Text content of static HTML, tags stripped and whitespace collapsed. */
export function text(html: string) {
  return html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
}
