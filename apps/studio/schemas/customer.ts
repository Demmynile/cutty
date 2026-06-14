import { defineField, defineType } from 'sanity'

export const customer = defineType({
  name: 'customer',
  title: 'Customer',
  type: 'document',
  fields: [
    defineField({ name: 'uid', title: 'Auth UID', type: 'string', validation: (r) => r.required() }),
    defineField({ name: 'fullName', title: 'Full Name', type: 'string', validation: (r) => r.required() }),
    defineField({ name: 'email', title: 'Email', type: 'string', validation: (r) => r.required().email() }),
    defineField({ name: 'phone', title: 'Phone Number', type: 'string' }),
    defineField({ name: 'avatar', title: 'Avatar', type: 'image', options: { hotspot: true } }),
    defineField({ name: 'walletBalance', title: 'Wallet Balance (kobo)', type: 'number', initialValue: 0 }),
    defineField({ name: 'loyaltyPoints', title: 'Loyalty Points', type: 'number', initialValue: 0 }),
    defineField({ name: 'totalVisits', title: 'Total Visits', type: 'number', initialValue: 0 }),
    defineField({
      name: 'tier',
      title: 'Loyalty Tier',
      type: 'string',
      options: { list: ['bronze', 'silver', 'gold', 'platinum'] },
      initialValue: 'bronze',
    }),
    defineField({ name: 'isActive', title: 'Active', type: 'boolean', initialValue: true }),
    defineField({ name: 'createdAt', title: 'Created At', type: 'datetime' }),
  ],
  preview: {
    select: { title: 'fullName', subtitle: 'email', media: 'avatar' },
  },
})
