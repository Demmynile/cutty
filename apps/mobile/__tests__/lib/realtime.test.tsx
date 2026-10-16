// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '../helpers/render'

type Handler = (...args: unknown[]) => void

// Minimal Socket.IO client double: records emits, lets tests fire server events.
function fakeSocket() {
  const handlers = new Map<string, Set<Handler>>()
  const s = {
    connected: true,
    emitted: [] as Array<{ event: string; args: unknown[] }>,
    ackWith: undefined as undefined | ((event: string, args: unknown[]) => unknown[]),
    on: vi.fn((e: string, h: Handler) => { (handlers.get(e) ?? handlers.set(e, new Set()).get(e)!).add(h) }),
    off: vi.fn((e: string, h: Handler) => { handlers.get(e)?.delete(h) }),
    emit: vi.fn((event: string, ...args: unknown[]) => {
      s.emitted.push({ event, args })
      const ack = args.at(-1)
      if (typeof ack === 'function' && s.ackWith) ack(...s.ackWith(event, args))
    }),
    timeout: vi.fn(() => s),
    disconnect: vi.fn(),
    fire: (e: string, ...args: unknown[]) => handlers.get(e)?.forEach((h) => h(...args)),
    listeners: (e: string) => handlers.get(e)?.size ?? 0,
  }
  return s
}

const io = vi.hoisted(() => ({ current: null as ReturnType<typeof fakeSocket> | null, connect: vi.fn() }))

vi.mock('socket.io-client', () => ({
  io: (...args: unknown[]) => {
    io.connect(...args)
    return io.current
  },
}))
vi.mock('@/lib/auth', () => ({ getAuthToken: vi.fn(), getAuthRole: vi.fn() }))

const { getAuthToken, getAuthRole } = await import('@/lib/auth')
const realtime = await import('@/lib/realtime')

const message = (conversationId: string, text = 'hi') => ({ _id: `m-${text}`, conversationId, senderType: 'stylist', text, createdAt: 'now' })

beforeEach(() => {
  realtime.disconnectRealtime()
  io.current = fakeSocket()
  vi.mocked(getAuthToken).mockResolvedValue('tok')
  vi.mocked(getAuthRole).mockResolvedValue('customer')
})

describe('getSocket', () => {
  it('connects once over websocket to the dev-host realtime URL and reuses the socket', async () => {
    const [a, b] = await Promise.all([realtime.getSocket(), realtime.getSocket()])
    expect(a).toBe(io.current)
    expect(b).toBe(a)
    expect(await realtime.getSocket()).toBe(a)
    expect(io.connect).toHaveBeenCalledTimes(1)
    expect(io.connect).toHaveBeenCalledWith('http://192.168.1.50:4000', expect.objectContaining({ transports: ['websocket'] }))
  })

  it('sends a fresh token and the role on every (re)connect', async () => {
    await realtime.getSocket()
    const { auth } = io.connect.mock.calls[0][1] as { auth: (cb: (v: unknown) => void) => Promise<void> }
    vi.mocked(getAuthToken).mockResolvedValue('fresh')
    vi.mocked(getAuthRole).mockResolvedValue('stylist')
    const cb = vi.fn()
    await auth(cb)
    expect(cb).toHaveBeenCalledWith({ token: 'fresh', role: 'stylist' })
  })

  it('does not connect when signed out', async () => {
    vi.mocked(getAuthToken).mockResolvedValue(null)
    expect(await realtime.getSocket()).toBeNull()
    expect(io.connect).not.toHaveBeenCalled()
  })

  it('disconnectRealtime closes and forgets the socket', async () => {
    const s = await realtime.getSocket()
    realtime.disconnectRealtime()
    expect(s!.disconnect).toHaveBeenCalled()
    io.current = fakeSocket()
    expect(await realtime.getSocket()).toBe(io.current)
  })
})

describe('useMessageListener', () => {
  it('delivers new messages to the latest callback and unsubscribes on unmount', async () => {
    const first = vi.fn()
    const second = vi.fn()
    const hook = await renderHook((cb: (m: unknown) => void) => realtime.useMessageListener(cb), first)
    await hook.rerender(second)
    io.current!.fire('message:new', message('c1'))
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledWith(message('c1'))
    await hook.unmount()
    expect(io.current!.listeners('message:new')).toBe(0)
  })
})

describe('useConversation', () => {
  beforeEach(() => {
    io.current!.ackWith = (event) => (event === 'conversation:join' ? [{ ok: true }] : [])
  })

  it('joins the room and reports connected', async () => {
    const { result } = await renderHook(() => realtime.useConversation('c1', vi.fn()))
    expect(io.current!.emitted[0]).toMatchObject({ event: 'conversation:join', args: ['c1', expect.any(Function)] })
    expect(result.current.connected).toBe(true)
  })

  it('handles only this conversation’s messages and marks them read', async () => {
    const onMessage = vi.fn()
    await renderHook(() => realtime.useConversation('c1', onMessage))
    await act(async () => {
      io.current!.fire('message:new', message('other'))
      io.current!.fire('message:new', message('c1'))
    })
    expect(onMessage).toHaveBeenCalledTimes(1)
    expect(io.current!.emitted.filter((e) => e.event === 'conversation:read')).toEqual([{ event: 'conversation:read', args: ['c1'] }])
  })

  it('shows the other side typing for 3 seconds, cleared by a new message', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { result } = await renderHook(() => realtime.useConversation('c1', vi.fn()))
    await act(async () => io.current!.fire('typing', { conversationId: 'c1', by: 'stylist' }))
    expect(result.current.otherTyping).toBe(true)
    await act(async () => vi.advanceTimersByTime(3000))
    expect(result.current.otherTyping).toBe(false)

    await act(async () => io.current!.fire('typing', { conversationId: 'c1' }))
    await act(async () => io.current!.fire('message:new', message('c1')))
    expect(result.current.otherTyping).toBe(false)
    await act(async () => io.current!.fire('typing', { conversationId: 'elsewhere' }))
    expect(result.current.otherTyping).toBe(false)
    vi.useRealTimers()
  })

  it('tracks disconnects and rejoins on reconnect', async () => {
    const { result } = await renderHook(() => realtime.useConversation('c1', vi.fn()))
    await act(async () => io.current!.fire('disconnect'))
    expect(result.current.connected).toBe(false)
    await act(async () => io.current!.fire('connect'))
    expect(result.current.connected).toBe(true)
    expect(io.current!.emitted.filter((e) => e.event === 'conversation:join')).toHaveLength(2)
  })

  it('send resolves with the saved message or rejects with the server error', async () => {
    const { result } = await renderHook(() => realtime.useConversation('c1', vi.fn()))
    const saved = message('c1', 'hello')
    io.current!.ackWith = (event, args) => {
      if (event !== 'message:send') return []
      const { text } = args[0] as { text: string }
      return text === 'bad' ? [null, { ok: false, error: 'Message is empty or too long' }] : text === 'late' ? [new Error('timeout')] : [null, { ok: true, message: saved }]
    }
    await expect(result.current.send('hello', 'client-1')).resolves.toEqual(saved)
    expect(io.current!.timeout).toHaveBeenCalledWith(10_000)
    expect(io.current!.emitted.at(-1)).toMatchObject({ event: 'message:send', args: [{ conversationId: 'c1', text: 'hello', clientId: 'client-1' }, expect.any(Function)] })
    await expect(result.current.send('bad', 'x')).rejects.toThrow('Message is empty or too long')
    await expect(result.current.send('late', 'x')).rejects.toThrow('Message not sent. Try again.')
  })

  it('send waits for a connection in progress, and gives up after 8 seconds', async () => {
    const { result } = await renderHook(() => realtime.useConversation('c1', vi.fn()))
    const saved = message('c1', 'hello')
    io.current!.ackWith = (event) => (event === 'message:send' ? [null, { ok: true, message: saved }] : [{ ok: true }])
    io.current!.connected = false
    const pending = result.current.send('hello', 'c-1')
    await Promise.resolve()
    expect(io.current!.emitted.some((e) => e.event === 'message:send')).toBe(false)
    io.current!.connected = true
    io.current!.fire('connect')
    await expect(pending).resolves.toEqual(saved)

    vi.useFakeTimers()
    io.current!.connected = false
    const late = result.current.send('hello', 'c-2')
    const check = expect(late).rejects.toThrow(/Not connected/)
    await vi.advanceTimersByTimeAsync(8_000)
    await check
    vi.useRealTimers()
  })

  it('useRealtimeWarmup connects once someone is signed in', async () => {
    await renderHook(() => realtime.useRealtimeWarmup(undefined))
    expect(io.connect).not.toHaveBeenCalled()
    await renderHook(() => realtime.useRealtimeWarmup('c1'))
    expect(io.connect).toHaveBeenCalledTimes(1)
  })

  it('throttles typing notifications to one every 2 seconds', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const { result } = await renderHook(() => realtime.useConversation('c1', vi.fn()))
    result.current.typing()
    result.current.typing()
    vi.advanceTimersByTime(2000)
    result.current.typing()
    expect(io.current!.emitted.filter((e) => e.event === 'typing')).toHaveLength(2)
    vi.useRealTimers()
  })

  it('leaves the room and removes listeners on unmount', async () => {
    const hook = await renderHook(() => realtime.useConversation('c1', vi.fn()))
    await hook.unmount()
    expect(io.current!.emitted.at(-1)).toEqual({ event: 'conversation:leave', args: ['c1'] })
    for (const e of ['connect', 'disconnect', 'message:new', 'typing']) expect(io.current!.listeners(e)).toBe(0)
  })
})
