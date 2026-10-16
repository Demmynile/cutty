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

/**
 * A right-sized, compressed image URL: the CDN serves WebP/AVIF where the
 * device supports it, at the requested pixel width (pass ~2x the layout width).
 */
export function imageUri(source: SanityImage, width: number, height?: number) {
  const b = builder.image(source).width(width).auto('format').quality(75)
  return (height ? b.height(height).fit('crop') : b).url()
}

export function formatPrice(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString('en-NG')}`
}
