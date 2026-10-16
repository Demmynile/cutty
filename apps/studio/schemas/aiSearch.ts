import { defineArrayMember, defineField, defineType } from 'sanity'

// A customer's AI search ("knotless braids this weekend under ₦30k"). The
// latest results double as that customer's "Recommended for you" list.
export const aiSearch = defineType({
  name: 'aiSearch',
  title: 'AI Search',
  type: 'document',
  readOnly: true,
  fields: [
    defineField({ name: 'customer', type: 'reference', to: [{ type: 'customer' }], validation: (r) => r.required() }),
    defineField({ name: 'query', type: 'string', validation: (r) => r.required().max(300) }),
    defineField({ name: 'summary', type: 'text' }),
    defineField({
      name: 'stylists',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'stylistPick',
          fields: [
            defineField({ name: 'stylist', type: 'reference', to: [{ type: 'stylist' }] }),
            defineField({ name: 'reason', type: 'string' }),
          ],
        }),
      ],
    }),
    defineField({
      name: 'products',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'productPick',
          fields: [
            defineField({ name: 'product', type: 'reference', to: [{ type: 'product' }] }),
            defineField({ name: 'reason', type: 'string' }),
          ],
        }),
      ],
    }),
    defineField({ name: 'styles', type: 'array', of: [{ type: 'string' }], description: 'Try-on preset ids' }),
    defineField({ name: 'createdAt', type: 'datetime' }),
  ],
  preview: { select: { title: 'query', subtitle: 'customer.fullName' } },
})
