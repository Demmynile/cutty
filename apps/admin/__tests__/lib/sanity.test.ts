import { describe, expect, it } from 'vitest'
import { now, ref, serverClient } from '@/lib/server/sanity'
import { formatDate, formatPrice, sanityClient, urlFor } from '@/lib/sanity'

describe('lib/server/sanity', () => {
  it('configures an authenticated, uncached client on the published perspective', () => {
    expect(serverClient.config()).toMatchObject({ projectId: 'testproj', dataset: 'test', useCdn: false, perspective: 'published', apiVersion: '2024-01-01' })
  })

  it('builds references and ISO timestamps', () => {
    expect(ref('x')).toEqual({ _type: 'reference', _ref: 'x' })
    expect(now()).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/)
  })
})

describe('lib/sanity (dashboard helpers)', () => {
  it('reuses the server client', () => {
    expect(sanityClient).toBe(serverClient)
  })

  it('builds CDN image URLs for the configured project', () => {
    const url = urlFor({ _type: 'image', asset: { _type: 'reference', _ref: 'image-abc123-200x100-png' } }).width(50).url()
    expect(url).toBe('https://cdn.sanity.io/images/testproj/test/abc123-200x100.png?w=50')
  })

  it('formats kobo as naira', () => {
    expect(formatPrice(123_456_00)).toBe('₦123,456')
    expect(formatPrice(150)).toBe('₦1.5')
  })

  it('formats dates as "dd Mon yyyy"', () => {
    expect(formatDate('2026-06-05T10:00:00Z')).toMatch(/^05 Jun 2026$/)
  })
})
