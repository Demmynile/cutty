import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sanity } from '../../helpers/sanity'

vi.mock('@/lib/server/sanity', async () => (await import('../../helpers/sanity')).sanityModule)

const { broadcast, createMessage, loadConversationFor } = await import('@/lib/server/chat')

const convo = { _id: 'cv1', _rev: 'r', customerId: 'c1', stylistId: 's1' }

beforeEach(() => {
  sanity.reset()
})

describe('loadConversationFor', () => {
  beforeEach(() => sanity.on('_type == "conversation"', convo))

  it('returns the conversation to either participant', async () => {
    await expect(loadConversationFor('cv1', { type: 'customer', id: 'c1' })).resolves.toEqual(convo)
    await expect(loadConversationFor('cv1', { type: 'stylist', id: 's1' })).resolves.toEqual(convo)
  })

  it('404s for anyone else, including a customer using the stylist id', async () => {
    await expect(loadConversationFor('cv1', { type: 'customer', id: 'c2' })).rejects.toMatchObject({ status: 404 })
    await expect(loadConversationFor('cv1', { type: 'customer', id: 's1' })).rejects.toMatchObject({ status: 404 })
  })

  it('404s when the conversation does not exist', async () => {
    sanity.reset()
    await expect(loadConversationFor('nope', { type: 'customer', id: 'c1' })).rejects.toMatchObject({ status: 404 })
  })
})

describe('createMessage', () => {
  it.each([
    ['stylist', 'customerUnread'],
    ['customer', 'stylistUnread'],
  ] as const)("a %s message bumps the other side's %s", async (senderType, field) => {
    const msg = await createMessage({ conversationId: 'cv1', senderType, senderId: 'x', text: 'hello' })
    expect(msg).toMatchObject({ conversationId: 'cv1', senderType, senderId: 'x', text: 'hello', _id: expect.any(String) })
    const [tx] = sanity.writes
    if (tx.type !== 'transaction') throw new Error('expected a transaction')
    expect(tx.creates[0]).toMatchObject({ _id: msg._id, _type: 'chatMessage', conversation: { _ref: 'cv1' } })
    expect(tx.patches[0]).toMatchObject({ id: 'cv1', setIfMissing: { [field]: 0 }, inc: { [field]: 1 }, set: { lastMessagePreview: 'hello' } })
  })

  it('AI messages update the preview without touching unread counts', async () => {
    await createMessage({ conversationId: 'cv1', senderType: 'ai', text: 'x'.repeat(200) })
    const patch = sanity.patches()[0]
    expect(patch.inc).toEqual({})
    expect((patch.set.lastMessagePreview as string).length).toBe(120)
  })
})

describe('broadcast', () => {
  const message = { _id: 'm1', conversationId: 'cv1', senderType: 'ai' as const, text: 'hi', createdAt: '2026-01-01' }

  it('does nothing without realtime config', async () => {
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    vi.stubEnv('REALTIME_INTERNAL_URL', '')
    await broadcast(message)
    expect(f).not.toHaveBeenCalled()
  })

  it('posts the message with the shared secret', async () => {
    const f = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', f)
    vi.stubEnv('REALTIME_INTERNAL_URL', 'http://rt:4000/')
    vi.stubEnv('REALTIME_INTERNAL_SECRET', 's3cret')
    await broadcast(message)
    expect(f).toHaveBeenCalledWith('http://rt:4000/internal/broadcast', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'x-internal-secret': 's3cret' }),
      body: JSON.stringify({ message }),
    }))
  })

  it('swallows network errors (best effort)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down') }))
    vi.stubEnv('REALTIME_INTERNAL_URL', 'http://rt:4000')
    vi.stubEnv('REALTIME_INTERNAL_SECRET', 's3cret')
    await expect(broadcast(message)).resolves.toBeUndefined()
  })
})
