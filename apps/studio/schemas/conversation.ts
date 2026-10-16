import { defineField, defineType } from 'sanity'

// One thread between a customer and a stylist. Messages live in `chatMessage`
// documents; the realtime server (apps/realtime) writes both.
export const conversation = defineType({
  name: 'conversation',
  title: 'Conversation',
  type: 'document',
  readOnly: true,
  fields: [
    defineField({ name: 'customer', type: 'reference', to: [{ type: 'customer' }], validation: (r) => r.required() }),
    defineField({ name: 'stylist', type: 'reference', to: [{ type: 'stylist' }], validation: (r) => r.required() }),
    defineField({ name: 'lastMessageAt', type: 'datetime' }),
    defineField({ name: 'lastMessagePreview', type: 'string' }),
    defineField({ name: 'customerUnread', type: 'number', initialValue: 0 }),
    defineField({ name: 'stylistUnread', type: 'number', initialValue: 0 }),
    defineField({ name: 'createdAt', type: 'datetime' }),
  ],
  preview: {
    select: { customer: 'customer.fullName', stylist: 'stylist.fullName', subtitle: 'lastMessagePreview' },
    prepare: ({ customer, stylist, subtitle }: { customer?: string; stylist?: string; subtitle?: string }) => ({
      title: `${customer ?? 'Customer'} ↔ ${stylist ?? 'Stylist'}`,
      subtitle,
    }),
  },
})

export const chatMessage = defineType({
  name: 'chatMessage',
  title: 'Chat Message',
  type: 'document',
  readOnly: true,
  fields: [
    defineField({ name: 'conversation', type: 'reference', to: [{ type: 'conversation' }], validation: (r) => r.required() }),
    defineField({
      name: 'senderType',
      type: 'string',
      options: { list: ['customer', 'stylist', 'ai'] },
      validation: (r) => r.required(),
    }),
    defineField({ name: 'senderId', type: 'string', description: 'Customer or stylist _id; empty for AI.' }),
    defineField({ name: 'text', type: 'text', validation: (r) => r.required().max(4000) }),
    defineField({ name: 'clientId', type: 'string', description: 'Client-generated id, used to de-duplicate retries.' }),
    defineField({ name: 'createdAt', type: 'datetime' }),
  ],
  preview: { select: { title: 'text', subtitle: 'senderType' } },
})
