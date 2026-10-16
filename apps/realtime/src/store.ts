import { randomUUID } from 'node:crypto'
import { createClient } from '@sanity/client'
import type { ChatMessageDoc } from '@cutty/types'

export const sanity = createClient({
  projectId: required('SANITY_PROJECT_ID'),
  dataset: process.env.SANITY_DATASET || 'production',
  apiVersion: '2024-01-01',
  token: required('SANITY_API_TOKEN'),
  useCdn: false,
  perspective: 'published',
})

function required(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`${name} is not set`)
  return v
}

export type Principal = { type: 'customer' | 'stylist'; id: string }

/**
 * The customer or stylist document for a Clerk user, if it exists and is
 * active. Only approved stylists can chat with customers.
 */
export async function resolvePrincipal(type: Principal['type'], clerkUserId: string): Promise<Principal | null> {
  const doc = await sanity.fetch<{ _id: string; isActive?: boolean; status?: string } | null>(
    `*[_type == $type && clerkUserId == $clerkUserId][0]{ _id, isActive, status }`,
    { type, clerkUserId },
  )
  if (!doc || doc.isActive === false) return null
  if (type === 'stylist' && doc.status !== 'approved') return null
  return { type, id: doc._id }
}

export type Participants = { customerId: string; stylistId: string }

export async function participants(conversationId: string): Promise<Participants | null> {
  return sanity.fetch<Participants | null>(
    `*[_type == "conversation" && _id == $id][0]{ "customerId": customer._ref, "stylistId": stylist._ref }`,
    { id: conversationId },
  )
}

export function isParticipant(p: Principal, parts: Participants) {
  return p.type === 'customer' ? parts.customerId === p.id : parts.stylistId === p.id
}

// Saves the message and bumps the conversation's preview and the other
// side's unread count in one transaction. A retry with the same clientId
// returns the original message instead of saving a duplicate.
export async function saveMessage(conversationId: string, sender: Principal, text: string, clientId: string): Promise<ChatMessageDoc> {
  const existing = await sanity.fetch<ChatMessageDoc | null>(
    `*[_type == "chatMessage" && conversation._ref == $conversationId && clientId == $clientId && senderId == $senderId][0]{
      _id, "conversationId": conversation._ref, senderType, senderId, text, clientId, createdAt
    }`,
    { conversationId, clientId, senderId: sender.id },
  )
  if (existing) return existing

  const message: ChatMessageDoc = {
    _id: randomUUID(),
    conversationId,
    senderType: sender.type,
    senderId: sender.id,
    text,
    clientId,
    createdAt: new Date().toISOString(),
  }
  const unread = sender.type === 'customer' ? 'stylistUnread' : 'customerUnread'
  await sanity
    .transaction()
    .create({
      _id: message._id,
      _type: 'chatMessage',
      conversation: { _type: 'reference', _ref: conversationId },
      senderType: message.senderType,
      senderId: message.senderId,
      text: message.text,
      clientId,
      createdAt: message.createdAt,
    })
    .patch(conversationId, (p) =>
      p.set({ lastMessageAt: message.createdAt, lastMessagePreview: text.slice(0, 120) }).setIfMissing({ [unread]: 0 }).inc({ [unread]: 1 }),
    )
    .commit()
  return message
}

export async function markRead(conversationId: string, reader: Principal) {
  await sanity.patch(conversationId).set({ [reader.type === 'customer' ? 'customerUnread' : 'stylistUnread']: 0 }).commit()
}
