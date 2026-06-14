import { defineField, defineType } from 'sanity'

export const walletTransaction = defineType({
  name: 'walletTransaction',
  title: 'Wallet Transaction',
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
      title: 'Transaction Type',
      type: 'string',
      options: { list: ['credit', 'debit'] },
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'string',
      options: { list: ['topup', 'booking_payment', 'order_payment', 'refund', 'withdrawal', 'admin_adjust'] },
    }),
    defineField({ name: 'amount', title: 'Amount (kobo)', type: 'number', validation: (r) => r.required().min(0) }),
    defineField({ name: 'balanceAfter', title: 'Balance After (kobo)', type: 'number' }),
    defineField({ name: 'description', title: 'Description', type: 'string' }),
    defineField({ name: 'referenceId', title: 'Reference ID', type: 'string' }),
    defineField({ name: 'paymentReference', title: 'Payment Gateway Reference', type: 'string' }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      options: { list: ['pending', 'completed', 'failed', 'reversed'] },
      initialValue: 'completed',
    }),
    defineField({ name: 'createdAt', title: 'Created At', type: 'datetime' }),
  ],
  preview: {
    select: { title: 'customer.fullName', subtitle: 'category', amount: 'amount', type: 'type' },
    prepare({ title, subtitle, amount, type }) {
      const sign = type === 'credit' ? '+' : '-'
      return { title, subtitle: `${subtitle} ${sign}₦${(amount / 100).toLocaleString()}` }
    },
  },
})
