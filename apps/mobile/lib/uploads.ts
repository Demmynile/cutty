import { api } from './api'
import type { PreparedImage } from './imagePrep'

// Uploads a picked/captured image (already resized to ≤1024px JPEG by
// imagePrep) and returns the Sanity asset id to attach to a profile or product.
export async function uploadProImage(image: PreparedImage, purpose: 'photo' | 'product') {
  const { assetId } = await api<{ assetId: string }>('POST', '/api/v1/pro/uploads', { base64: image.base64, mediaType: image.mediaType, purpose }, 60_000)
  return assetId
}
