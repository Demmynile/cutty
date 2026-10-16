import 'server-only'
import type { ChatMessageDoc, ChatSenderType } from '@cutty/types'
import { serverClient, ref, now } from './sanity'
import { HttpError, afterResponse } from './http'
import { newId } from './ledger'
import { CONVERSATION_PARTICIPANTS, THREAD_PAGE } from './proQueries'

export type Participant = { type: 'customer'; id: string } | { type: 'stylist'; id: string }

export async function loadConversationFor(conversationId: string, who: Participant) {
  const convo = await serverClient.fetch<{ _id: string; _rev: string; customerId: string; stylistId: string } | null>(
    CONVERSATION_PARTICIPANTS,
    { id: conversationId },
  )
  const owns = convo && (who.type === 'customer' ? convo.customerId === who.id : convo.stylistId === who.id)
  if (!convo || !owns) throw new HttpError(404, 'Conversation not found')
  return convo
}

type ThreadRow = {
  _id: string; customerId: string; stylistId: string
  customerUnread: number; stylistUnread: number; messages: ChatMessageDoc[]
}

/**
 * A page of a thread's history for one of its participants (one Sanity query).
 * Loading the newest page marks the thread read for them; that write happens
 * after the response is sent, and only when there is something to clear.
 */
export async function threadPage(conversationId: string, who: Participant, before = '9999'): Promise<ChatMessageDoc[]> {
  const t = await serverClient.fetch<ThreadRow | null>(THREAD_PAGE, { id: conversationId, before })
  const owns = t && (who.type === 'customer' ? t.customerId === who.id : t.stylistId === who.id)
  if (!t || !owns) throw new HttpError(404, 'Conversation not found')

  const unreadField = who.type === 'customer' ? 'customerUnread' : 'stylistUnread'
  if (before === '9999' && t[unreadField] > 0) {
    afterResponse(() => serverClient.patch(t._id).set({ [unreadField]: 0 }).commit())
  }
  return t.messages ?? []
}

// Same write the realtime server does for typed messages (apps/realtime/src/store.ts);
// used here for AI replies posted into a thread.
export async function createMessage(args: {
  conversationId: string
  senderType: ChatSenderType
  senderId?: string
  text: string
}): Promise<ChatMessageDoc> {
  const message: ChatMessageDoc = {
    _id: newId(),
    conversationId: args.conversationId,
    senderType: args.senderType,
    senderId: args.senderId,
    text: args.text,
    createdAt: now(),
  }
  const unreadField = args.senderType === 'stylist' ? 'customerUnread' : args.senderType === 'customer' ? 'stylistUnread' : null
  await serverClient
    .transaction()
    .create({
      _id: message._id,
      _type: 'chatMessage',
      conversation: ref(args.conversationId),
      senderType: message.senderType,
      senderId: message.senderId,
      text: message.text,
      createdAt: message.createdAt,
    })
    .patch(args.conversationId, (p) => {
      const q = p.set({ lastMessageAt: message.createdAt, lastMessagePreview: message.text.slice(0, 120) })
      return unreadField ? q.setIfMissing({ [unreadField]: 0 }).inc({ [unreadField]: 1 }) : q
    })
    .commit()
  return message
}

// Pushes a message to everyone in the conversation's socket room. Best effort:
// the message is already saved, and clients re-fetch history when they open
// a thread, so a missed broadcast only delays delivery.
export async function broadcast(message: ChatMessageDoc) {
  const url = process.env.REALTIME_INTERNAL_URL
  const secret = process.env.REALTIME_INTERNAL_SECRET
  if (!url || !secret) return
  try {
    await fetch(`${url.replace(/\/$/, '')}/internal/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': secret },
      body: JSON.stringify({ message }),
      signal: AbortSignal.timeout(3000),
    })
  } catch (err) {
    console.error('[realtime] broadcast failed', err)
  }
}
