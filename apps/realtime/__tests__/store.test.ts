import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// A recording stand-in for the Sanity client the store creates at import.
const sanity = vi.hoisted(() => {
  const commits: Array<{ creates: unknown[]; patches: Array<{ id: string; ops: Record<string, unknown> }> }> = []
  const patchOps = (id: string) => {
    const ops: Record<string, unknown> = {}
    const b = {
      set: (v: object) => { ops.set = { ...(ops.set as object), ...v }; return b },
      setIfMissing: (v: object) => { ops.setIfMissing = v; return b },
      inc: (v: object) => { ops.inc = v; return b },
      commit: async () => { commits.push({ creates: [], patches: [{ id, ops }] }) },
      ops,
    }
    return b
  }
  const client = {
    fetch: vi.fn(),
    patch: vi.fn((id: string) => patchOps(id)),
    transaction: vi.fn(() => {
      const creates: unknown[] = []
      const patches: Array<{ id: string; ops: Record<string, unknown> }> = []
      const tx = {
        create: (d: unknown) => { creates.push(d); return tx },
        patch: (id: string, fn: (p: ReturnType<typeof patchOps>) => unknown) => { const p = patchOps(id); fn(p); patches.push({ id, ops: p.ops }); return tx },
        commit: async () => { commits.push({ creates, patches }) },
      }
      return tx
    }),
  }
  return { client, commits, createClient: vi.fn(() => client) }
})

vi.mock('@sanity/client', () => ({ createClient: sanity.createClient }))

let store: typeof import('../src/store')
let clientConfig: unknown

beforeAll(async () => {
  vi.stubEnv('SANITY_PROJECT_ID', 'proj')
  vi.stubEnv('SANITY_API_TOKEN', 'tok')
  store = await import('../src/store')
  clientConfig = sanity.createClient.mock.calls[0]?.[0] // before mockReset clears it
})

beforeEach(() => {
  sanity.commits.length = 0
})

describe('store configuration', () => {
  it('creates an authenticated, uncached client', () => {
    expect(clientConfig).toEqual({
      projectId: 'proj', dataset: 'production', apiVersion: '2024-01-01', token: 'tok', useCdn: false, perspective: 'published',
    })
  })

  it('refuses to start without credentials', async () => {
    vi.resetModules()
    vi.stubEnv('SANITY_PROJECT_ID', 'proj')
    vi.stubEnv('SANITY_API_TOKEN', '')
    await expect(import('../src/store')).rejects.toThrow('SANITY_API_TOKEN is not set')
  })
})

describe('resolvePrincipal', () => {
  it('maps an active customer or approved stylist to a principal', async () => {
    sanity.client.fetch.mockResolvedValueOnce({ _id: 'c1', isActive: true })
    await expect(store.resolvePrincipal('customer', 'user_1')).resolves.toEqual({ type: 'customer', id: 'c1' })
    expect(sanity.client.fetch).toHaveBeenCalledWith(expect.any(String), { type: 'customer', clerkUserId: 'user_1' })

    sanity.client.fetch.mockResolvedValueOnce({ _id: 's1', status: 'approved' })
    await expect(store.resolvePrincipal('stylist', 'user_2')).resolves.toEqual({ type: 'stylist', id: 's1' })
  })

  it.each([
    ['missing', 'customer', null],
    ['deactivated', 'customer', { _id: 'c1', isActive: false }],
    ['unapproved stylist', 'stylist', { _id: 's1', status: 'pending' }],
  ] as const)('rejects a %s account', async (_l, type, doc) => {
    sanity.client.fetch.mockResolvedValueOnce(doc)
    await expect(store.resolvePrincipal(type, 'u')).resolves.toBeNull()
  })
})

describe('participants', () => {
  it('reads the two sides of a conversation', async () => {
    sanity.client.fetch.mockResolvedValueOnce({ customerId: 'c1', stylistId: 's1' })
    await expect(store.participants('cv1')).resolves.toEqual({ customerId: 'c1', stylistId: 's1' })
  })

  it('isParticipant checks the matching side only', () => {
    const parts = { customerId: 'c1', stylistId: 's1' }
    expect(store.isParticipant({ type: 'customer', id: 'c1' }, parts)).toBe(true)
    expect(store.isParticipant({ type: 'stylist', id: 's1' }, parts)).toBe(true)
    expect(store.isParticipant({ type: 'customer', id: 's1' }, parts)).toBe(false)
    expect(store.isParticipant({ type: 'stylist', id: 'c1' }, parts)).toBe(false)
  })
})

describe('saveMessage', () => {
  it("saves the message and bumps the other side's unread count in one transaction", async () => {
    sanity.client.fetch.mockResolvedValueOnce(null)
    const m = await store.saveMessage('cv1', { type: 'customer', id: 'c1' }, 'Hello there', 'client-1')
    expect(m).toMatchObject({ conversationId: 'cv1', senderType: 'customer', senderId: 'c1', text: 'Hello there', clientId: 'client-1' })
    const [{ creates, patches }] = sanity.commits
    expect(creates[0]).toMatchObject({ _id: m._id, _type: 'chatMessage', conversation: { _type: 'reference', _ref: 'cv1' } })
    expect(patches[0]).toEqual({ id: 'cv1', ops: { set: { lastMessageAt: m.createdAt, lastMessagePreview: 'Hello there' }, setIfMissing: { stylistUnread: 0 }, inc: { stylistUnread: 1 } } })
  })

  it('stylist messages bump the customer’s count and previews are truncated', async () => {
    sanity.client.fetch.mockResolvedValueOnce(null)
    await store.saveMessage('cv1', { type: 'stylist', id: 's1' }, 'x'.repeat(300), 'c2')
    const { ops } = sanity.commits[0].patches[0]
    expect(ops.inc).toEqual({ customerUnread: 1 })
    expect((ops.set as { lastMessagePreview: string }).lastMessagePreview).toHaveLength(120)
  })

  it('returns the original message for a retried clientId instead of saving twice', async () => {
    const existing = { _id: 'm1', clientId: 'client-1', text: 'Hello' }
    sanity.client.fetch.mockResolvedValueOnce(existing)
    await expect(store.saveMessage('cv1', { type: 'customer', id: 'c1' }, 'Hello', 'client-1')).resolves.toBe(existing)
    expect(sanity.commits).toEqual([])
    expect(sanity.client.fetch).toHaveBeenCalledWith(expect.any(String), { conversationId: 'cv1', clientId: 'client-1', senderId: 'c1' })
  })
})

describe('markRead', () => {
  it("clears the reader's unread count", async () => {
    await store.markRead('cv1', { type: 'customer', id: 'c1' })
    await store.markRead('cv1', { type: 'stylist', id: 's1' })
    expect(sanity.commits.map((c) => c.patches[0].ops.set)).toEqual([{ customerUnread: 0 }, { stylistUnread: 0 }])
  })
})
