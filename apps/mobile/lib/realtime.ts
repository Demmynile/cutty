import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { ChatMessageDoc, ClientToServerEvents, ServerToClientEvents } from '@cutty/types'
import { getAuthRole, getAuthToken } from './auth'
import { resolveDevUrl } from './devHost'

// One Socket.IO connection to apps/realtime, shared by every screen and
// authenticated with the same Clerk session token as the API. History always comes from
// the API; the socket only carries new messages, read receipts and typing.
type ChatSocket = Socket<ServerToClientEvents, ClientToServerEvents>

const REALTIME_URL = resolveDevUrl(process.env.EXPO_PUBLIC_REALTIME_URL)

let socket: ChatSocket | null = null
let connecting: Promise<ChatSocket | null> | null = null

export async function getSocket(): Promise<ChatSocket | null> {
  if (!REALTIME_URL) return null
  if (socket) return socket
  if (connecting) return connecting
  connecting = (async () => {
    const token = await getAuthToken()
    if (!token) return null
    socket = io(REALTIME_URL, {
      transports: ['websocket'],
      // Clerk tokens are short-lived, so fetch a fresh one on every (re)connect.
      auth: async (cb) => cb({ token: (await getAuthToken()) ?? '', role: await getAuthRole() }),
      reconnectionDelayMax: 10_000,
    })
    return socket
  })()
  try {
    return await connecting
  } finally {
    connecting = null
  }
}

/**
 * Opens the socket as soon as someone is signed in, so a chat is already
 * connected when it's opened instead of starting the handshake then.
 */
export function useRealtimeWarmup(accountId: string | undefined) {
  useEffect(() => {
    if (accountId) getSocket().catch(() => {})
  }, [accountId])
}

const NOT_CONNECTED = 'Not connected. Check your connection and try again.'
const CONNECT_WAIT_MS = 8_000

// Resolves once the socket is connected, waiting briefly if it's still
// connecting (app just opened, or reconnecting after a network change).
function whenConnected(s: ChatSocket | null): Promise<ChatSocket> {
  if (!s) return Promise.reject(new Error(NOT_CONNECTED))
  if (s.connected) return Promise.resolve(s)
  return new Promise((resolve, reject) => {
    const onConnect = () => {
      clearTimeout(timer)
      resolve(s)
    }
    const timer = setTimeout(() => {
      s.off('connect', onConnect)
      reject(new Error(NOT_CONNECTED))
    }, CONNECT_WAIT_MS)
    s.on('connect', onConnect)
  })
}

export function disconnectRealtime() {
  socket?.disconnect()
  socket = null
}

/** Subscribes to new messages anywhere (conversation lists, unread badges). */
export function useMessageListener(onMessage: (m: ChatMessageDoc) => void) {
  const handler = useRef(onMessage)
  handler.current = onMessage
  useEffect(() => {
    let s: ChatSocket | null = null
    const listener = (m: ChatMessageDoc) => handler.current(m)
    getSocket().then((sock) => {
      s = sock
      s?.on('message:new', listener)
    })
    return () => {
      s?.off('message:new', listener)
    }
  }, [])
}

/**
 * Joins one conversation's room while the thread is open. Returns whether the
 * socket is connected, whether the other side is typing, and `send`, which
 * resolves with the saved message (or throws with the server's error).
 */
export function useConversation(conversationId: string, onMessage: (m: ChatMessageDoc) => void) {
  const [connected, setConnected] = useState(false)
  const [otherTyping, setOtherTyping] = useState(false)
  const socketRef = useRef<ChatSocket | null>(null)
  const handler = useRef(onMessage)
  handler.current = onMessage

  useEffect(() => {
    let cancelled = false
    let typingTimer: ReturnType<typeof setTimeout> | undefined
    const join = () => socketRef.current?.emit('conversation:join', conversationId, (res) => !cancelled && setConnected(res.ok))
    const onNew = (m: ChatMessageDoc) => {
      if (m.conversationId !== conversationId) return
      setOtherTyping(false)
      handler.current(m)
      socketRef.current?.emit('conversation:read', conversationId)
    }
    const onTyping = (p: { conversationId: string }) => {
      if (p.conversationId !== conversationId) return
      setOtherTyping(true)
      clearTimeout(typingTimer)
      typingTimer = setTimeout(() => setOtherTyping(false), 3000)
    }
    const onDisconnect = () => setConnected(false)

    getSocket().then((s) => {
      if (cancelled || !s) return
      socketRef.current = s
      s.on('connect', join)
      s.on('disconnect', onDisconnect)
      s.on('message:new', onNew)
      s.on('typing', onTyping)
      if (s.connected) join()
    })
    return () => {
      cancelled = true
      clearTimeout(typingTimer)
      const s = socketRef.current
      s?.emit('conversation:leave', conversationId)
      s?.off('connect', join)
      s?.off('disconnect', onDisconnect)
      s?.off('message:new', onNew)
      s?.off('typing', onTyping)
    }
  }, [conversationId])

  async function send(text: string, clientId: string): Promise<ChatMessageDoc> {
    const s = await whenConnected(socketRef.current ?? (await getSocket()))
    return new Promise((resolve, reject) => {
      s.timeout(10_000).emit('message:send', { conversationId, text, clientId }, (err, res) => {
        if (err) return reject(new Error('Message not sent. Try again.'))
        if (res.ok) resolve(res.message)
        else reject(new Error(res.error))
      })
    })
  }

  const lastTyping = useRef(0)
  function typing() {
    if (Date.now() - lastTyping.current < 2000) return
    lastTyping.current = Date.now()
    socketRef.current?.emit('typing', conversationId)
  }

  return { connected, otherTyping, send, typing }
}
