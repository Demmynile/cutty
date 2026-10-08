import { defineField, defineType } from 'sanity'

export const booking = defineType({
  name: 'booking',
  title: 'Booking',
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
      name: 'barber',
      title: 'Stylist',
      type: 'reference',
      to: [{ type: 'barber' }],
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'services',
      title: 'Services',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'service' }] }],
      validation: (r) => r.required().min(1),
    }),
    defineField({ name: 'bookingDate', title: 'Booking Date', type: 'date', validation: (r) => r.required() }),
    defineField({ name: 'startTime', title: 'Start Time', type: 'string', validation: (r) => r.required() }),
    defineField({ name: 'endTime', title: 'End Time', type: 'string' }),
    defineField({ name: 'totalAmount', title: 'Total Amount (kobo)', type: 'number' }),
    defineField({ name: 'discountAmount', title: 'Discount Amount (kobo)', type: 'number', initialValue: 0 }),
    defineField({ name: 'pointsEarned', title: 'Points Earned', type: 'number', initialValue: 0 }),
    defineField({
      name: 'paymentMethod',
      title: 'Payment Method',
      type: 'string',
      options: { list: ['wallet', 'card', 'cash', 'transfer'] },
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      options: { list: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'] },
      initialValue: 'pending',
    }),
    defineField({
      name: 'discountCode',
      title: 'Discount Code Used',
      type: 'reference',
      to: [{ type: 'discountCode' }],
    }),
    defineField({ name: 'notes', title: 'Customer Notes', type: 'text' }),
    defineField({ name: 'cancelReason', title: 'Cancellation Reason', type: 'string' }),
    defineField({ name: 'review', title: 'Customer Review', type: 'text' }),
    defineField({ name: 'rating', title: 'Rating', type: 'number', validation: (r) => r.min(1).max(5) }),
    defineField({ name: 'createdAt', title: 'Created At', type: 'datetime' }),
  ],
  preview: {
    select: {
      title: 'customer.fullName',
      subtitle: 'bookingDate',
      status: 'status',
    },
    prepare({ title, subtitle, status }) {
      return { title: title || 'Unknown Customer', subtitle: `${subtitle} — ${status}` }
    },
  },
})
