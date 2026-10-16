import { createServer } from 'node:net'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { io as connect, type Socket } from 'socket.io-client'

// Boots the real Socket.IO server (src/index.ts) on a free port with the
// Sanity store and Clerk verification mocked, then talks to it like the app.

const store = vi.hoisted(() => ({
  resolvePrincipal: vi.fn(),
  participants: vi.fn(),
  saveMessage: vi.fn(),
  markRead: vi.fn(),
}))

// Tokens look like "ok-<accountId>"; anything else fails verification.
vi.mock('../src/auth.js', () => ({ verifyToken: vi.fn(async (t: string) => (t.startsWith('ok-') ? t.slice(3) : null)) }))
vi.mock('../src/store.js', () => ({
  ...store,
  // Pure helper, same as src/store.ts (importing the real module needs Sanity credentials).
  isParticipant: (p: { type: string; id: string }, parts: { customerId: string; stylistId: string }) =>
    p.type === 'customer' ? parts.customerId === p.id : parts.stylistId === p.id,
}))

const SECRET = 'internal-secret'
const AWAY_DELAY = 250
const PARTS = { customerId: 'c1', stylistId: 's1' }
// Rate limits are per account, so tests that spend a budget get their own accounts.
const CONVERSATIONS: Record<string, { customerId: string; stylistId: string }> = {
  cv1: PARTS,
  'cv-flood': { customerId: 'cf', stylistId: 's1' },
  cva: { customerId: 'ca', stylistId: 'sa' },
}
const realFetch = globalThis.fetch
let port: number
let fetchMock: ReturnType<typeof vi.fn>
const sockets: Socket[] = []

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function freePort() {
  return new Promise<number>((resolve) => {
    const srv = createServer().listen(0, () => {
      const p = (srv.address() as { port: number }).port
      srv.close(() => resolve(p))
    })
  })
}

function wireStore() {
  store.resolvePrincipal.mockImplementation(async (type: string, id: string) => ({ type, id }))
  store.participants.mockImplementation(async (id: string) => CONVERSATIONS[id] ?? null)
  store.saveMessage.mockImplementation(async (conversationId: string, sender: { type: string; id: string }, text: string, clientId: string) => ({
    _id: `m-${clientId}`, conversationId, senderType: sender.type, senderId: sender.id, text, clientId, createdAt: 'now',
  }))
  store.markRead.mockResolvedValue(undefined)
}

async function client(token: string, role: string) {
  const s = connect(`http://localhost:${port}`, { transports: ['websocket'], auth: { token, role }, reconnection: false, forceNew: true })
  sockets.push(s)
  await new Promise<void>((resolve, reject) => {
    s.once('connect', () => resolve())
    s.once('connect_error', (e) => reject(e))
  })
  return s
}

const emit = <T>(s: Socket, event: string, ...args: unknown[]) => new Promise<T>((resolve) => s.emit(event, ...args, resolve))
const next = <T>(s: Socket, event: string, ms = 1000) =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`no ${event}`)), ms)
    s.once(event, (v: T) => { clearTimeout(t); resolve(v) })
  })
/** Resolves true if `event` does NOT arrive within `ms`. */
const silent = (s: Socket, event: string, ms = 150) =>
  new Promise<boolean>((resolve) => {
    const h = () => resolve(false)
    s.once(event, h)
    setTimeout(() => { s.off(event, h); resolve(true) }, ms)
  })
const send = (s: Socket, text: string, clientId: string, conversationId = 'cv1') =>
  emit<{ ok: boolean; error?: string; message?: { text: string } }>(s, 'message:send', { conversationId, text, clientId })

// Set for the whole file (the server reads some of these per request), not
// with vi.stubEnv, which is undone after each test.
const ENV = { PORT: '', REALTIME_INTERNAL_SECRET: SECRET, ADMIN_INTERNAL_URL: 'http://admin.internal/', AWAY_REPLY_DELAY_MS: String(AWAY_DELAY), ACCOUNT_RECHECK_MS: '0' }
const savedEnv: Record<string, string | undefined> = {}

beforeAll(async () => {
  port = await freePort()
  ENV.PORT = String(port)
  for (const [k, v] of Object.entries(ENV)) {
    savedEnv[k] = process.env[k]
    process.env[k] = v
  }
  vi.spyOn(console, 'log').mockImplementation(() => {})
  await import('../src/index')
  await sleep(50)
})

beforeEach(() => {
  while (sockets.length) sockets.pop()!.disconnect()
  wireStore()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ result: 'sent' })))
  vi.stubGlobal('fetch', fetchMock)
})

afterAll(() => {
  for (const s of sockets) s.disconnect()
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
})

describe('connection auth', () => {
  it('accepts a verified token for an existing account', async () => {
    expect((await client('ok-c1', 'customer')).connected).toBe(true)
    expect(store.resolvePrincipal).toHaveBeenCalledWith('customer', 'c1')
  })

  it('treats any role other than stylist as customer', async () => {
    await client('ok-c1', 'admin')
    expect(store.resolvePrincipal).toHaveBeenCalledWith('customer', 'c1')
  })

  it.each([['an invalid token', 'forged'], ['an empty token', '']])('rejects %s', async (_l, token) => {
    await expect(client(token, 'customer')).rejects.toThrow('unauthorized')
  })

  it('rejects users without an active account, or when the lookup fails', async () => {
    store.resolvePrincipal.mockResolvedValueOnce(null)
    await expect(client('ok-c1', 'customer')).rejects.toThrow('unauthorized')
    store.resolvePrincipal.mockRejectedValueOnce(new Error('sanity down'))
    await expect(client('ok-c1', 'customer')).rejects.toThrow('unauthorized')
  })
})

describe('conversation:join', () => {
  it('lets participants join and refuses everyone else', async () => {
    const customer = await client('ok-c1', 'customer')
    expect(await emit(customer, 'conversation:join', 'cv1')).toEqual({ ok: true })
    const stranger = await client('ok-c2', 'customer')
    expect(await emit(stranger, 'conversation:join', 'cv1')).toEqual({ ok: false, error: 'Conversation not found' })
    expect(await emit(customer, 'conversation:join', 'missing')).toEqual({ ok: false, error: 'Conversation not found' })
    expect(await emit(customer, 'conversation:join', 'x'.repeat(121))).toEqual({ ok: false, error: 'Conversation not found' })
  })

  it('caches membership per socket', async () => {
    const customer = await client('ok-c1', 'customer')
    await emit(customer, 'conversation:join', 'cv1')
    await emit(customer, 'conversation:join', 'cv1')
    expect(store.participants).toHaveBeenCalledTimes(1)
  })
})

describe('message:send', () => {
  it('saves, then delivers to the thread and both personal rooms', async () => {
    const customer = await client('ok-c1', 'customer')
    const stylist = await client('ok-s1', 'stylist') // not in the thread: gets it via its personal room
    const delivered = next<{ text: string }>(stylist, 'message:new')
    const res = await send(customer, '  Hello  ', 'k1')
    expect(res).toMatchObject({ ok: true, message: { text: 'Hello', senderType: 'customer' } })
    expect(store.saveMessage).toHaveBeenCalledWith('cv1', { type: 'customer', id: 'c1' }, 'Hello', 'k1')
    expect((await delivered).text).toBe('Hello')
  })

  it('does not deliver to people outside the conversation', async () => {
    const customer = await client('ok-c1', 'customer')
    const other = await client('ok-c2', 'customer')
    const quiet = silent(other, 'message:new')
    await send(customer, 'private', 'k2')
    expect(await quiet).toBe(true)
  })

  it.each([
    [{ text: '   ', clientId: 'k' }, 'Message is empty or too long'],
    [{ text: 'x'.repeat(4001), clientId: 'k' }, 'Message is empty or too long'],
    [{ text: 'hi' }, 'Message is empty or too long'],
    [{ text: 'hi', clientId: 'k', conversationId: 'cv-other' }, 'Conversation not found'],
  ])('rejects %o', async (payload, error) => {
    const customer = await client('ok-c1', 'customer')
    expect(await emit(customer, 'message:send', { conversationId: 'cv1', ...payload })).toEqual({ ok: false, error })
    expect(store.saveMessage).not.toHaveBeenCalled()
  })

  it('limits each account to 20 messages per 10 seconds, across all its sockets', async () => {
    const phone = await client('ok-cf', 'customer')
    const tablet = await client('ok-cf', 'customer')
    const results = []
    for (let i = 0; i < 21; i++) results.push(await send(i % 2 ? tablet : phone, `m${i}`, `r${i}`, 'cv-flood'))
    expect(results.slice(0, 20).every((r) => r.ok)).toBe(true)
    expect(results[20]).toEqual({ ok: false, error: 'You are sending messages too quickly' })
  })

  it('reports storage failures without crashing', async () => {
    const customer = await client('ok-c1', 'customer')
    store.saveMessage.mockRejectedValueOnce(new Error('sanity down'))
    expect(await send(customer, 'hi', 'k')).toEqual({ ok: false, error: 'Message not sent. Try again.' })
    expect((await send(customer, 'again', 'k3')).ok).toBe(true)
  })
})

describe('read receipts and typing', () => {
  it('marks read and tells the other side', async () => {
    const customer = await client('ok-c1', 'customer')
    const stylist = await client('ok-s1', 'stylist')
    await emit(customer, 'conversation:join', 'cv1')
    await emit(stylist, 'conversation:join', 'cv1')
    const receipt = next(customer, 'conversation:read')
    stylist.emit('conversation:read', 'cv1')
    expect(await receipt).toEqual({ conversationId: 'cv1', by: 'stylist' })
    expect(store.markRead).toHaveBeenCalledWith('cv1', { type: 'stylist', id: 's1' })
  })

  it('relays typing between sockets in the thread only', async () => {
    const customer = await client('ok-c1', 'customer')
    const stylist = await client('ok-s1', 'stylist')
    await emit(customer, 'conversation:join', 'cv1')

    const notJoinedYet = silent(stylist, 'typing')
    customer.emit('typing', 'cv1')
    expect(await notJoinedYet).toBe(true)

    await emit(stylist, 'conversation:join', 'cv1')
    const typed = next(customer, 'typing')
    stylist.emit('typing', 'cv1')
    expect(await typed).toEqual({ conversationId: 'cv1', by: 'stylist' })
  })

  it('ignores typing from sockets that never joined, and stops after leaving', async () => {
    const customer = await client('ok-c1', 'customer')
    const stylist = await client('ok-s1', 'stylist')
    await emit(stylist, 'conversation:join', 'cv1')
    const ignored = silent(stylist, 'typing')
    customer.emit('typing', 'cv1')
    expect(await ignored).toBe(true)

    await emit(customer, 'conversation:join', 'cv1')
    customer.emit('conversation:leave', 'cv1')
    await sleep(30)
    const afterLeave = silent(customer, 'typing')
    stylist.emit('typing', 'cv1')
    expect(await afterLeave).toBe(true)
  })
})

describe('away assistant trigger', () => {
  beforeEach(async () => {
    // Let timers scheduled by earlier tests fire against their own fetch mock.
    await sleep(AWAY_DELAY + 50)
    fetchMock.mockClear()
  })

  const waitForFetch = () => vi.waitFor(() => expect(fetchMock).toHaveBeenCalled(), { timeout: 2000 })

  it('asks the admin API to reply when the stylist is offline', async () => {
    const customer = await client('ok-ca', 'customer')
    await send(customer, 'hello?', 'a1', 'cva')
    await waitForFetch()
    expect(fetchMock).toHaveBeenCalledWith('http://admin.internal/api/internal/away-reply', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': SECRET },
      body: JSON.stringify({ conversationId: 'cva' }),
    }))
  })

  it('sends one request for a burst of messages', async () => {
    const customer = await client('ok-ca', 'customer')
    for (let i = 0; i < 3; i++) await send(customer, `m${i}`, `b${i}`, 'cva')
    await waitForFetch()
    await sleep(AWAY_DELAY)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('stays quiet while the stylist has a device connected', async () => {
    const customer = await client('ok-ca', 'customer')
    await client('ok-sa', 'stylist')
    await send(customer, 'hi', 'o1', 'cva')
    await sleep(AWAY_DELAY + 100)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('cancels the pending reply when the stylist starts typing', async () => {
    const customer = await client('ok-ca', 'customer')
    await send(customer, 'hi', 't1', 'cva')
    const stylist = await client('ok-sa', 'stylist')
    await emit(stylist, 'conversation:join', 'cva')
    stylist.emit('typing', 'cva')
    await sleep(20)
    stylist.disconnect() // offline again by the time the timer would fire
    await sleep(AWAY_DELAY + 100)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('is never triggered by stylist messages', async () => {
    const stylist = await client('ok-sa', 'stylist')
    await send(stylist, 'back now', 'sm1', 'cva')
    stylist.disconnect()
    await sleep(AWAY_DELAY + 100)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('logs a failed admin call', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 502 }))
    const customer = await client('ok-ca', 'customer')
    await send(customer, 'hi', 'f1', 'cva')
    await vi.waitFor(() => expect(console.error).toHaveBeenCalledWith('[realtime] away reply failed', 502), { timeout: 2000 })
  })
})

describe('abuse limits', () => {
  it('throttles read receipts, which are database writes', async () => {
    const stylist = await client('ok-s1', 'stylist')
    await emit(stylist, 'conversation:join', 'cv1')
    for (let i = 0; i < 40; i++) stylist.emit('conversation:read', 'cv1')
    await sleep(150)
    expect(store.markRead.mock.calls.length).toBeLessThanOrEqual(30)
    expect(store.markRead.mock.calls.length).toBeGreaterThan(0)
  })

  it('drops a socket whose account was suspended or deactivated since connecting', async () => {
    const customer = await client('ok-c1', 'customer')
    expect((await send(customer, 'hi', 'sus1')).ok).toBe(true)
    store.resolvePrincipal.mockResolvedValue(null) // account suspended or deactivated
    const disconnected = new Promise((r) => customer.once('disconnect', r))
    expect(await send(customer, 'still here?', 'sus2')).toEqual({ ok: false, error: 'Your account can no longer chat.' })
    await disconnected
    expect(store.saveMessage).toHaveBeenCalledTimes(1)
  })
})

describe('internal HTTP', () => {
  const url = (path: string) => `http://localhost:${port}${path}`
  const broadcast = (headers: Record<string, string>, body: string) => realFetch(url('/internal/broadcast'), { method: 'POST', headers, body })

  it('reports health', async () => {
    const res = await realFetch(url('/health'))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, connections: expect.any(Number) })
  })

  it('delivers messages posted by the admin API to the participants', async () => {
    const customer = await client('ok-c1', 'customer')
    const got = next<{ text: string }>(customer, 'message:new')
    const res = await broadcast(
      { 'x-internal-secret': SECRET, 'content-type': 'application/json' },
      JSON.stringify({ message: { _id: 'm-ai', conversationId: 'cv1', senderType: 'ai', text: 'Ada is away', createdAt: 'now' } }),
    )
    expect(res.status).toBe(204)
    expect((await got).text).toBe('Ada is away')
  })

  it('rejects a wrong or missing secret, bad bodies and unknown paths', async () => {
    expect((await broadcast({ 'x-internal-secret': 'nope' }, '{}')).status).toBe(401)
    expect((await broadcast({}, '{}')).status).toBe(401)
    expect((await broadcast({ 'x-internal-secret': SECRET }, 'not json')).status).toBe(400)
    expect((await broadcast({ 'x-internal-secret': SECRET }, JSON.stringify({ message: {} }))).status).toBe(400)
    expect((await broadcast({ 'x-internal-secret': SECRET }, 'x'.repeat(40_000))).status).toBe(400)
    expect((await realFetch(url('/nope'))).status).toBe(404)
  })
})
