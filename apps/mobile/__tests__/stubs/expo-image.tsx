import { createElement } from 'react'

export const Image = ({ source, accessibilityLabel }: { source?: unknown; accessibilityLabel?: string }) =>
  createElement('img', {
    alt: accessibilityLabel ?? '',
    src: typeof source === 'string' ? source : (source as { uri?: string; testUri?: string } | undefined)?.uri ?? (source as { testUri?: string } | undefined)?.testUri,
  })
