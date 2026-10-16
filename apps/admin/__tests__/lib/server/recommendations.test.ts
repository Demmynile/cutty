import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sanity } from '../../helpers/sanity'

vi.mock('@/lib/server/sanity', async () => (await import('../../helpers/sanity')).sanityModule)

const { hydrateSearch, recommendationsFor } = await import('@/lib/server/recommendations')

beforeEach(() => {
  sanity.reset()
})

describe('hydrateSearch', () => {
  it('fetches one aiSearch by id', async () => {
    sanity.on('_type == "aiSearch"', { _id: 'q1', query: 'braids' })
    await expect(hydrateSearch('q1')).resolves.toEqual({ _id: 'q1', query: 'braids' })
    expect(sanity.client.fetch).toHaveBeenCalledWith(expect.stringContaining('stylist->status == "approved"'), { id: 'q1' })
  })
})

describe('recommendationsFor', () => {
  it("returns the customer's latest search as personalized", async () => {
    const latest = { query: 'fade', summary: 's', styles: ['buzz'], stylists: [{ reason: 'r', stylist: { _id: 's1' } }], products: [] }
    sanity.on('.latestSearch->', latest)
    await expect(recommendationsFor('c1')).resolves.toEqual({ ...latest, personalized: true })
  })

  it('falls back to top stylists and featured products when there is no useful search', async () => {
    sanity.on('.latestSearch->', { query: 'x', summary: '', styles: [], stylists: [], products: [] })
    sanity.on('"Top rated on Cutty"', { stylists: [{ reason: 'Top rated on Cutty' }], products: [] })
    const rec = await recommendationsFor('c1')
    expect(rec).toMatchObject({ personalized: false, query: '', styles: [], stylists: [{ reason: 'Top rated on Cutty' }] })
    expect(rec.summary).toMatch(/Search with Cutty AI/)
  })
})
