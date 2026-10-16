import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sanity } from '../../helpers/sanity'

vi.mock('@/lib/server/sanity', async () => (await import('../../helpers/sanity')).sanityModule)

const { productFields, productSchema } = await import('@/lib/server/proSchemas')

const ASSET = 'image-0123456789abcdef0123-640x480-png'

beforeEach(() => {
  sanity.reset()
})

describe('productSchema', () => {
  it('enforces a ₦1 minimum price and limits on images and tags', () => {
    const base = { name: 'Gel', price: 100, stock: 1 }
    expect(productSchema.safeParse(base).success).toBe(true)
    expect(productSchema.safeParse({ ...base, price: 99 }).success).toBe(false)
    expect(productSchema.safeParse({ ...base, imageAssetIds: Array(7).fill(ASSET) }).success).toBe(false)
    expect(productSchema.safeParse({ ...base, tags: Array(16).fill('t') }).success).toBe(false)
  })
})

describe('productFields', () => {
  it('maps only the fields that were given', async () => {
    expect(await productFields({ stock: 3 })).toEqual({ stock: 3 })
  })

  it('derives points from price (1 per ₦100)', async () => {
    expect(await productFields({ price: 259_999 })).toEqual({ price: 259_999, pointsEarned: 25 })
  })

  it('splits the description into portable-text paragraphs', async () => {
    const { description } = await productFields({ description: 'First para.\n\n\nSecond para.' })
    expect(description).toEqual([
      expect.objectContaining({ _type: 'block', _key: 'p0', children: [expect.objectContaining({ text: 'First para.' })] }),
      expect.objectContaining({ _key: 'p1', children: [expect.objectContaining({ text: 'Second para.' })] }),
    ])
  })

  it('turns asset ids into keyed image values and rejects foreign URLs', async () => {
    expect((await productFields({ imageAssetIds: [ASSET] })).images).toEqual([{ _type: 'image', _key: 'img0', asset: { _type: 'reference', _ref: ASSET } }])
    await expect(productFields({ imageAssetIds: ['https://evil/x.png'] })).rejects.toMatchObject({ status: 400 })
  })

  it('keeps compareAtPrice unless it is null', async () => {
    expect(await productFields({ compareAtPrice: 5000 })).toEqual({ compareAtPrice: 5000 })
    expect(await productFields({ compareAtPrice: null })).toEqual({})
  })

  it('references a category only if it exists', async () => {
    sanity.on('_type == "category"', (p: { id: string }) => (p.id === 'cat1' ? 1 : 0))
    expect(await productFields({ categoryId: 'cat1' })).toEqual({ category: { _type: 'reference', _ref: 'cat1' } })
    await expect(productFields({ categoryId: 'nope' })).rejects.toMatchObject({ status: 400, message: 'Unknown category' })
  })

  it('passes tags and isActive through', async () => {
    expect(await productFields({ tags: ['a'], isActive: false, name: 'N' })).toEqual({ tags: ['a'], isActive: false, name: 'N' })
  })
})
