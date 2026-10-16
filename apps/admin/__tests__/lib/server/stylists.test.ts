import { beforeEach, describe, expect, it } from 'vitest'
import { vi } from 'vitest'
import { sanity } from '../../helpers/sanity'

vi.mock('@/lib/server/sanity', async () => (await import('../../helpers/sanity')).sanityModule)

const { IMAGE_REF_PATTERN, imageValue, loadAccount, slugify, sniffImageType, syncBarber, toAccount, uploadImage } = await import('@/lib/server/stylists')

const ASSET = 'image-0123456789abcdef0123-640x480-jpg'

beforeEach(() => {
  sanity.reset()
})

describe('toAccount', () => {
  it('masks the bank account to its last 4 digits and drops the Paystack code', () => {
    const account = toAccount({
      _id: 's1', shop: { status: 'approved', name: 'Shop', accountNumber: '0123456789', subaccountCode: 'ACCT_secret', bankCode: '058' },
    } as never)
    expect(account.shop).toMatchObject({ status: 'approved', name: 'Shop', bankCode: '058', accountNumberLast4: '6789' })
    expect(JSON.stringify(account)).not.toContain('0123456789')
    expect(JSON.stringify(account)).not.toContain('ACCT_secret')
  })

  it("defaults a missing shop to status 'none'", () => {
    expect(toAccount({ _id: 's1', shop: null } as never).shop).toEqual(expect.objectContaining({ status: 'none', accountNumberLast4: undefined }))
  })
})

describe('loadAccount', () => {
  it('loads and masks the account, 404ing when missing', async () => {
    await expect(loadAccount('s1')).rejects.toMatchObject({ status: 404 })
    sanity.on('_type == "stylist"', { _id: 's1', shop: { status: 'requested', accountNumber: '9999888877' } })
    await expect(loadAccount('s1')).resolves.toMatchObject({ shop: { accountNumberLast4: '8877' } })
  })
})

describe('syncBarber', () => {
  const approved = {
    _id: 's1', status: 'approved', fullName: 'Ada Obi', displayName: 'Ada Cuts', bio: 'Hi', skills: ['fades'], rating: 4.5, totalReviews: 3,
    weeklyAvailability: [
      { day: 'friday', start: '12:00', end: '20:00' },
      { _key: 'k', day: 'monday', start: '09:00', end: '17:00' },
    ],
    timeOff: ['2026-07-01'],
  }

  it('does nothing for an unknown stylist or an unapproved one without a barber', async () => {
    expect(await syncBarber('x')).toBeUndefined()
    sanity.on('_type == "stylist"', { ...approved, status: 'pending' })
    expect(await syncBarber('s1')).toBeUndefined()
    expect(sanity.writes).toEqual([])
  })

  it('creates a bookable barber for a newly approved stylist and links it', async () => {
    sanity.on('_type == "stylist"', approved)
    const barberId = await syncBarber('s1')
    const [tx] = sanity.writes
    if (tx.type !== 'transaction') throw new Error('expected a transaction')
    expect(tx.creates[0]).toMatchObject({
      _id: barberId, _type: 'barber', name: 'Ada Cuts', specialties: ['fades'], isAvailable: true,
      workingDays: ['Monday', 'Friday'], workingHours: { start: '09:00', end: '20:00' },
      weeklyAvailability: [
        { _key: 'w0', day: 'friday', start: '12:00', end: '20:00' },
        { _key: 'k', day: 'monday', start: '09:00', end: '17:00' },
      ],
      timeOff: ['2026-07-01'], rating: 4.5, totalReviews: 3, stylist: { _ref: 's1' },
    })
    expect(tx.patches[0]).toMatchObject({ id: 's1', set: { barber: { _ref: barberId } } })
  })

  it('updates the existing barber, marking it unavailable when the stylist is suspended', async () => {
    sanity.on('_type == "stylist"', { ...approved, status: 'suspended', barberId: 'b1', weeklyAvailability: [] })
    expect(await syncBarber('s1')).toBe('b1')
    const patch = sanity.patches()[0]
    expect(patch.id).toBe('b1')
    expect(patch.set).toMatchObject({ isAvailable: false, workingDays: [] })
    expect(patch.set).not.toHaveProperty('workingHours')
  })

  it('treats isActive=false as not approved', async () => {
    sanity.on('_type == "stylist"', { ...approved, isActive: false, barberId: 'b1' })
    await syncBarber('s1')
    expect(sanity.patches()[0].set.isAvailable).toBe(false)
  })
})

describe('uploadImage', () => {
  const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])
  const b64 = PNG.toString('base64')

  it('uploads allowed types and returns an image reference', async () => {
    await expect(uploadImage(b64, 'image/png', 'p.png')).resolves.toEqual({
      _type: 'image', asset: { _type: 'reference', _ref: 'image-abc123abc123abc123abc123-100x100-jpg' },
    })
    expect(sanity.client.assets.upload).toHaveBeenCalledWith('image', expect.any(Buffer), { contentType: 'image/png', filename: 'p.png' })
  })

  it('rejects files whose bytes are not the declared image type', async () => {
    await expect(uploadImage(Buffer.from('<script>alert(1)</script>').toString('base64'), 'image/png', 'x.png')).rejects.toMatchObject({ status: 400 })
    await expect(uploadImage(b64, 'image/jpeg', 'x.jpg')).rejects.toMatchObject({ status: 400 }) // PNG bytes labelled JPEG
    expect(sanity.client.assets.upload).not.toHaveBeenCalled()
  })

  it.each([
    ['image/jpeg', [0xff, 0xd8, 0xff, 0xe0]],
    ['image/png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
    ['image/webp', [...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBP')]],
  ])('sniffs %s from its magic bytes', (type, bytes) => {
    expect(sniffImageType(Buffer.from(bytes))).toBe(type)
  })

  it('rejects other media types, empty and oversized images', async () => {
    await expect(uploadImage(b64, 'image/gif', 'x.gif')).rejects.toMatchObject({ status: 400 })
    await expect(uploadImage('', 'image/jpeg', 'x.jpg')).rejects.toMatchObject({ status: 400 })
    const big = Buffer.alloc(4.5 * 1024 * 1024 + 1).toString('base64')
    await expect(uploadImage(big, 'image/jpeg', 'x.jpg')).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/4.5 MB/) })
  })
})

describe('imageValue', () => {
  it('accepts Sanity asset ids, optionally keyed', () => {
    expect(imageValue(ASSET)).toEqual({ _type: 'image', asset: { _type: 'reference', _ref: ASSET } })
    expect(imageValue(ASSET, 'img0')).toMatchObject({ _key: 'img0' })
  })

  it.each(['https://evil.example/x.jpg', 'image-xyz-1x1-jpg', 'image-0123456789abcdef0123-640x480-gif', 'file-0123456789abcdef0123-pdf'])(
    'rejects %s',
    (bad) => {
      expect(IMAGE_REF_PATTERN.test(bad)).toBe(false)
      expect(() => imageValue(bad)).toThrow(expect.objectContaining({ status: 400 }))
    },
  )
})

describe('slugify', () => {
  it('lower-cases, strips accents and punctuation, and joins words with hyphens', () => {
    expect(slugify('  Shea Butter — Crème Deluxe!! ')).toBe('shea-butter-creme-deluxe')
    expect(slugify('a__b  c--d')).toBe('a-b-c-d')
  })

  it('caps the length at 80', () => {
    expect(slugify('x'.repeat(200))).toHaveLength(80)
  })
})
