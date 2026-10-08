import imageUrlBuilder from '@sanity/image-url'
import type { SanityImage } from '@cutty/types'

// Image URLs only. The app has no Sanity client or token — data comes from
// the Cutty API (lib/api.ts). Project id and dataset are not secrets.
const builder = imageUrlBuilder({
  projectId: process.env.EXPO_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.EXPO_PUBLIC_SANITY_DATASET || 'production',
})

export function urlFor(source: SanityImage) {
  return builder.image(source)
}

export function formatPrice(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString('en-NG')}`
}
