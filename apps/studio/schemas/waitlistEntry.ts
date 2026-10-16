import { defineField, defineType } from 'sanity'

// Sign-ups from the marketing site (apps/web), written by POST /api/v1/waitlist.
export const waitlistEntry = defineType({
  name: 'waitlistEntry',
  title: 'Waitlist Entry',
  type: 'document',
  fields: [
    defineField({ name: 'email', title: 'Email', type: 'string', validation: (r) => r.required().email() }),
    defineField({ name: 'name', title: 'Name', type: 'string' }),
    defineField({
      name: 'role',
      title: 'Joining as',
      type: 'string',
      options: { list: ['customer', 'stylist'] },
      initialValue: 'customer',
    }),
    defineField({ name: 'city', title: 'City', type: 'string' }),
    defineField({ name: 'createdAt', title: 'Joined At', type: 'datetime' }),
  ],
  orderings: [{ title: 'Newest first', name: 'createdAtDesc', by: [{ field: 'createdAt', direction: 'desc' }] }],
  preview: {
    select: { title: 'email', subtitle: 'role' },
  },
})
