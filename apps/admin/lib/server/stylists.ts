import 'server-only'
import type { AvailabilityWindow, SanityImage, StylistAccount, StylistShop, Weekday } from '@cutty/types'
import { WEEKDAYS } from '@cutty/types'
import { serverClient, ref } from './sanity'
import { HttpError } from './http'
import { newId } from './ledger'
import { invalidateCatalog } from './cache'
import { STYLIST_ACCOUNT_RAW } from './proQueries'

type RawShop = Omit<StylistShop, 'accountNumberLast4'> & { accountNumber?: string; subaccountCode?: string }
type RawAccount = Omit<StylistAccount, 'shop'> & { shop?: RawShop | null }

// Never return the full bank account number or Paystack codes to the app.
export function toAccount(raw: RawAccount): StylistAccount {
  const shop = raw.shop ?? { status: 'none' as const }
  return {
    ...raw,
    shop: {
      status: shop.status ?? 'none',
      name: shop.name,
      description: shop.description,
      bankCode: shop.bankCode,
      bankName: shop.bankName,
      accountName: shop.accountName,
      accountNumberLast4: shop.accountNumber ? shop.accountNumber.slice(-4) : undefined,
      commissionPercent: shop.commissionPercent,
      reviewNote: shop.reviewNote,
    },
  }
}

export async function loadAccount(stylistId: string): Promise<StylistAccount> {
  const raw = await serverClient.fetch<RawAccount | null>(STYLIST_ACCOUNT_RAW, { id: stylistId })
  if (!raw) throw new HttpError(404, 'Account not found')
  return toAccount(raw)
}

const DAY_LABEL: Record<Weekday, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday',
  friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
}

// Approved stylists are bookable through the existing `barber` document, so
// the customer booking flow, admin bookings page and reports keep working.
// Called on approval and whenever the stylist edits profile or availability.
export async function syncBarber(stylistId: string): Promise<string | undefined> {
  const s = await serverClient.fetch<{
    _id: string; status?: string; isActive?: boolean; fullName: string; displayName?: string
    photo?: SanityImage; bio?: string; skills?: string[]; weeklyAvailability?: AvailabilityWindow[]; timeOff?: string[]
    rating?: number; totalReviews?: number; barberId?: string
  } | null>(
    `*[_type == "stylist" && _id == $id][0]{ _id, status, isActive, fullName, displayName, photo, bio, skills, weeklyAvailability, timeOff, rating, totalReviews, "barberId": barber._ref }`,
    { id: stylistId },
  )
  if (!s) return undefined
  const approved = s.status === 'approved' && s.isActive !== false
  if (!approved && !s.barberId) return undefined

  const windows = s.weeklyAvailability ?? []
  const days = WEEKDAYS.filter((d) => windows.some((w) => w.day === d))
  const starts = windows.map((w) => w.start).sort()
  const ends = windows.map((w) => w.end).sort()

  const fields = {
    name: s.displayName || s.fullName,
    bio: s.bio,
    specialties: s.skills ?? [],
    isAvailable: approved,
    weeklyAvailability: windows.map((w, i) => ({ _key: w._key ?? `w${i}`, day: w.day, start: w.start, end: w.end })),
    timeOff: s.timeOff ?? [],
    workingDays: days.map((d) => DAY_LABEL[d]),
    ...(starts.length ? { workingHours: { start: starts[0], end: ends[ends.length - 1] } } : {}),
    ...(s.photo ? { photo: s.photo } : {}),
    rating: s.rating ?? 0,
    totalReviews: s.totalReviews ?? 0,
    stylist: ref(s._id),
  }

  // The public barber list and stylist directory are cached; drop them.
  if (s.barberId) {
    await serverClient.patch(s.barberId).set(fields).commit()
    await invalidateCatalog()
    return s.barberId
  }
  const barberId = newId()
  await serverClient
    .transaction()
    .create({ _id: barberId, _type: 'barber', ...fields })
    .patch(s._id, (p) => p.set({ barber: ref(barberId) }))
    .commit()
  await invalidateCatalog()
  return barberId
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const MAX_UPLOAD_BASE64_CHARS = 6_000_000

// Stores an image in Sanity's asset store and returns an image field value.
export async function uploadImage(base64: string, mediaType: string, filename: string): Promise<SanityImage> {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(mediaType)) throw new HttpError(400, 'Only JPEG, PNG or WebP images are allowed.')
  const buffer = Buffer.from(base64, 'base64')
  if (buffer.length === 0 || buffer.length > 4.5 * 1024 * 1024) throw new HttpError(400, 'Image must be under 4.5 MB.')
  if (sniffImageType(buffer) !== mediaType) throw new HttpError(400, 'That file is not a valid JPEG, PNG or WebP image.')
  const asset = await serverClient.assets.upload('image', buffer, { contentType: mediaType, filename })
  return { _type: 'image', asset: { _type: 'reference', _ref: asset._id } }
}

/** The real image type from the file's magic bytes, or null. */
export function sniffImageType(b: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  return null
}

// Image values sent back by the app must point at assets that already exist
// (uploaded through /api/v1/pro/uploads), never at arbitrary URLs.
export const IMAGE_REF_PATTERN = /^image-[a-f0-9]{20,64}-\d+x\d+-(jpg|jpeg|png|webp)$/

export function imageValue(assetRef: string, key?: string) {
  if (!IMAGE_REF_PATTERN.test(assetRef)) throw new HttpError(400, 'Invalid image')
  return { _type: 'image' as const, ...(key ? { _key: key } : {}), asset: { _type: 'reference' as const, _ref: assetRef } }
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .slice(0, 80)
}
