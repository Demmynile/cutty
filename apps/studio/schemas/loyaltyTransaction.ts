import { defineField, defineType } from 'sanity'

export const loyaltyTransaction = defineType({
  name: 'loyaltyTransaction',
  title: 'Loyalty Transaction',
  type: 'document',
  fields: [
    defineField({
      name: 'customer',
      title: 'Customer',
      type: 'reference',
      to: [{ type: 'customer' }],
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'type',
      title: 'Type',
      type: 'string',
      options: { list: ['earn', 'redeem', 'expire', 'bonus', 'adjust'] },
      validation: (r) => r.required(),
    }),
    defineField({ name: 'points', title: 'Points', type: 'number', validation: (r) => r.required() }),
    defineField({ name: 'balanceAfter', title: 'Balance After', type: 'number' }),
    defineField({ name: 'description', title: 'Description', type: 'string' }),
    defineField({
      name: 'source',
      title: 'Source',
      type: 'string',
      options: { list: ['booking', 'order', 'referral', 'bonus', 'admin', 'redemption', 'stylist'] },
    }),
    defineField({
      name: 'stylist',
      title: 'Awarded By (stylist)',
      type: 'reference',
      to: [{ type: 'stylist' }],
      description: 'Set on bonus points a Cutty Pro stylist gave this customer.',
    }),
    defineField({ name: 'referenceId', title: 'Reference ID', type: 'string' }),
    defineField({ name: 'createdAt', title: 'Created At', type: 'datetime' }),
  ],
  preview: {
    select: { title: 'customer.fullName', subtitle: 'type', points: 'points' },
    prepare({ title, subtitle, points }) {
      return { title, subtitle: `${subtitle} — ${points > 0 ? '+' : ''}${points} pts` }
    },
  },
})
