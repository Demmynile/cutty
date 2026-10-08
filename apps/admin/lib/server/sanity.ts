import 'server-only'
import { createClient } from '@sanity/client'

// The only Sanity client with credentials. Server-only: importing this from a
// client component fails the build, so the token can never reach a browser
// bundle. The dataset itself should be PRIVATE — every read goes through here.
export const serverClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  apiVersion: '2024-01-01',
  useCdn: false,
  token: process.env.SANITY_API_TOKEN,
  perspective: 'published',
})

export function ref(id: string) {
  return { _type: 'reference' as const, _ref: id }
}

export function now() {
  return new Date().toISOString()
}
