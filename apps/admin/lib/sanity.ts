import 'server-only'
import imageUrlBuilder from '@sanity/image-url'
import type { SanityImage } from '@cutty/types'
import { serverClient } from './server/sanity'

// Dashboard pages are server components behind the admin session check in
// middleware.ts. They read through the authenticated server client because
// the dataset is private; writes go through server actions (app/(dashboard)/actions.ts).
export const sanityClient = serverClient

const builder = imageUrlBuilder({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
})
export function urlFor(source: SanityImage) {
  return builder.image(source)
}

export function formatPrice(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString('en-NG')}`
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}
