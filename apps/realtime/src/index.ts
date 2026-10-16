import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { Server, type Socket } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import { Redis } from 'ioredis'
import type { ChatMessageDoc, ClientToServerEvents, ServerToClientEvents } from '@cutty/types'
import { verifyToken } from './auth.js'
import { isParticipant, markRead, participants, resolvePrincipal, saveMessage, type Principal } from './store.js'

// Cutty realtime chat. Clients connect with the same Clerk session token they
// use for the API (plus the role they're signed in as); every event re-checks that the caller belongs to the conversation.
// Messages are persisted to Sanity before they are delivered, so history
// (GET /api/v1/conversations/:id/messages) is always the source of truth.

type SocketData = { principal: Principal; clerkUserId: string; checkedAt: number }
type ChatSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>

const PORT = Number(process.env.PORT || 4000)
const MAX_TEXT = 4000
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean)

const userRoom = (p: { type: string; id: string }) => `user:${p.type}:${p.id}`
const convoRoom = (id: string) => `conversation:${id}`

const httpServer = createServer(handleHttp)
const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
  cors: { origin: allowedOrigins.length ? allowedOrigins : false },
  maxHttpBufferSize: 64 * 1024,
  pingInterval: 25_000,
})

// Running more than one realtime server? Set REDIS_URL so messages, typing and
// "is the stylist online" checks reach sockets connected to the other servers.
if (process.env.REDIS_URL) {
  const pub = new Redis(process.env.REDIS_URL)
  const sub = pub.duplicate()
  for (const c of [pub, sub]) c.on('error', (err) => console.error('[redis]', err.message))
  io.adapter(createAdapter(pub, sub))
}

io.use(async (socket, next) => {
  const { token, role } = socket.handshake.auth ?? {}
  const clerkUserId = typeof token === 'string' && token ? await verifyToken(token) : null
  const type = role === 'stylist' ? 'stylist' : 'customer'
  const principal = clerkUserId ? await resolvePrincipal(type, clerkUserId).catch(() => null) : null
  if (!principal) return next(new Error('unauthorized'))
  socket.data.principal = principal
  socket.data.clerkUserId = clerkUserId!
  socket.data.checkedAt = Date.now()
  next()
})

// Fixed-window flood control keyed by account, so opening more sockets
// doesn't buy more messages, read writes or typing events.
const windows = new Map<string, { count: number; resetAt: number }>()
function allow(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  const w = windows.get(key)
  if (!w || now > w.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs })
    if (windows.size > 50_000) for (const [k, v] of windows) if (now > v.resetAt) windows.delete(k)
    return true
  }
  return ++w.count <= limit
}

// Accounts can be deactivated or suspended while connected: re-check at most
// once a minute (on send). The caller drops the socket when this fails.
const RECHECK_MS = Number(process.env.ACCOUNT_RECHECK_MS ?? 60_000)
async function stillAllowed(socket: ChatSocket) {
  if (Date.now() - socket.data.checkedAt < RECHECK_MS) return true
  const p = await resolvePrincipal(socket.data.principal.type, socket.data.clerkUserId).catch(() => null)
  if (!p || p.id !== socket.data.principal.id) return false
  socket.data.checkedAt = Date.now()
  return true
}

io.on('connection', (socket: ChatSocket) => {
  const me = socket.data.principal
  socket.join(userRoom(me))
  const who = `${me.type}:${me.id}`
  const joined = new Map<string, { customerId: string; stylistId: string }>()

  async function access(conversationId: string) {
    if (typeof conversationId !== 'string' || conversationId.length > 120) return null
    const cached = joined.get(conversationId)
    if (cached) return cached
    const parts = await participants(conversationId)
    if (!parts || !isParticipant(me, parts)) return null
    joined.set(conversationId, parts)
    return parts
  }

  socket.on('conversation:join', async (conversationId, ack) => {
    const parts = await access(conversationId).catch(() => null)
    if (!parts) return ack?.({ ok: false, error: 'Conversation not found' })
    socket.join(convoRoom(conversationId))
    ack?.({ ok: true })
  })

  socket.on('conversation:leave', (conversationId) => {
    if (typeof conversationId === 'string') socket.leave(convoRoom(conversationId))
  })

  socket.on('message:send', async (payload, ack) => {
    try {
      const text = typeof payload?.text === 'string' ? payload.text.trim() : ''
      const clientId = typeof payload?.clientId === 'string' ? payload.clientId.slice(0, 64) : ''
      if (!text || text.length > MAX_TEXT || !clientId) return ack?.({ ok: false, error: 'Message is empty or too long' })
      if (!allow(`send:${who}`, 20, 10_000)) return ack?.({ ok: false, error: 'You are sending messages too quickly' })
      if (!(await stillAllowed(socket))) {
        ack?.({ ok: false, error: 'Your account can no longer chat.' })
        socket.disconnect(true) // after the reply, which is flushed before closing
        return
      }
      const parts = await access(payload.conversationId)
      if (!parts) return ack?.({ ok: false, error: 'Conversation not found' })

      const message = await saveMessage(payload.conversationId, me, text, clientId)
      deliver(message, parts)
      if (me.type === 'customer') scheduleAwayReply(payload.conversationId, parts.stylistId)
      ack?.({ ok: true, message })
    } catch (err) {
      console.error('[realtime] send failed', err)
      ack?.({ ok: false, error: 'Message not sent. Try again.' })
    }
  })

  socket.on('conversation:read', async (conversationId) => {
    // Each read receipt is a database write; cap them.
    if (!allow(`read:${who}`, 30, 10_000)) return
    const parts = await access(conversationId).catch(() => null)
    if (!parts) return
    await markRead(conversationId, me).catch((err) => console.error('[realtime] read failed', err))
    socket.to(convoRoom(conversationId)).emit('conversation:read', { conversationId, by: me.type })
  })

  socket.on('typing', async (conversationId) => {
    if (!joined.has(conversationId) || !allow(`typing:${who}`, 20, 10_000)) return
    if (me.type === 'stylist') cancelAwayReply(conversationId)
    socket.to(convoRoom(conversationId)).emit('typing', { conversationId, by: me.type })
  })
})

// To the open thread and to both people's personal rooms (for their
// conversation lists and unread badges). Socket.IO de-duplicates sockets
// that are in more than one of these rooms.
function deliver(message: ChatMessageDoc, parts: { customerId: string; stylistId: string }) {
  io.to([
    convoRoom(message.conversationId),
    userRoom({ type: 'customer', id: parts.customerId }),
    userRoom({ type: 'stylist', id: parts.stylistId }),
  ]).emit('message:new', message)
}

// ─── Away assistant ───────────────────────────────────────────────────────
// When a customer writes to a stylist with no device connected, ask the admin
// API to let Cutty AI answer. We wait a little first so a burst of messages
// gets one reply, and re-check presence in case the stylist opened the app.
// The API re-checks everything else (stylist opted in, daily cap, etc.).

const AWAY_DELAY_MS = Number(process.env.AWAY_REPLY_DELAY_MS || 20_000)
const awayTimers = new Map<string, NodeJS.Timeout>()

async function stylistOnline(stylistId: string) {
  return (await io.in(userRoom({ type: 'stylist', id: stylistId })).fetchSockets()).length > 0
}

function scheduleAwayReply(conversationId: string, stylistId: string) {
  const url = process.env.ADMIN_INTERNAL_URL
  const secret = process.env.REALTIME_INTERNAL_SECRET
  if (!url || !secret) return
  clearTimeout(awayTimers.get(conversationId))
  awayTimers.set(
    conversationId,
    setTimeout(async () => {
      awayTimers.delete(conversationId)
      try {
        if (await stylistOnline(stylistId)) return
        const res = await fetch(`${url.replace(/\/$/, '')}/api/internal/away-reply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-internal-secret': secret },
          body: JSON.stringify({ conversationId }),
          signal: AbortSignal.timeout(60_000),
        })
        if (!res.ok) console.error('[realtime] away reply failed', res.status)
      } catch (err) {
        console.error('[realtime] away reply failed', err)
      }
    }, AWAY_DELAY_MS),
  )
}

// While the stylist types, hold off: they're about to answer.
function cancelAwayReply(conversationId: string) {
  clearTimeout(awayTimers.get(conversationId))
  awayTimers.delete(conversationId)
}

// ─── Internal HTTP: health check + broadcasts from the admin API ──────────

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

async function readJson(req: IncomingMessage, maxBytes = 32 * 1024): Promise<unknown> {
  let size = 0
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    size += chunk.length
    if (size > maxBytes) throw new Error('too large')
    chunks.push(chunk as Buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

async function handleHttp(req: IncomingMessage, res: ServerResponse) {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, connections: io?.engine?.clientsCount ?? 0 }))
    return
  }
  if (req.url === '/internal/broadcast' && req.method === 'POST') {
    const secret = process.env.REALTIME_INTERNAL_SECRET
    const given = req.headers['x-internal-secret']
    if (!secret || typeof given !== 'string' || !safeEqual(given, secret)) {
      res.writeHead(401).end()
      return
    }
    try {
      const body = (await readJson(req)) as { message?: ChatMessageDoc }
      const message = body.message
      if (!message?.conversationId) throw new Error('missing message')
      const parts = await participants(message.conversationId)
      if (parts) deliver(message, parts)
      res.writeHead(204).end()
    } catch {
      res.writeHead(400).end()
    }
    return
  }
  res.writeHead(404).end()
}

httpServer.listen(PORT, () => console.log(`[realtime] listening on :${PORT}`))
