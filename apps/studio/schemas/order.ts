import { defineField, defineType } from 'sanity'

export const order = defineType({
  name: 'order',
  title: 'Order',
  type: 'document',
  fields: [
    defineField({ name: 'orderNumber', title: 'Order Number', type: 'string' }),
    defineField({
      name: 'customer',
      title: 'Customer',
      type: 'reference',
      to: [{ type: 'customer' }],
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'items',
      title: 'Order Items',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'product', title: 'Product', type: 'reference', to: [{ type: 'product' }] },
            { name: 'quantity', title: 'Quantity', type: 'number' },
            { name: 'priceAtOrder', title: 'Price at Order (kobo)', type: 'number' },
            { name: 'productName', title: 'Product Name (snapshot)', type: 'string' },
          ],
        },
      ],
    }),
    defineField({ name: 'subtotal', title: 'Subtotal (kobo)', type: 'number' }),
    defineField({ name: 'discountAmount', title: 'Discount Amount (kobo)', type: 'number', initialValue: 0 }),
    defineField({ name: 'shippingFee', title: 'Shipping Fee (kobo)', type: 'number', initialValue: 0 }),
    defineField({ name: 'totalAmount', title: 'Total Amount (kobo)', type: 'number' }),
    defineField({ name: 'pointsEarned', title: 'Loyalty Points Earned', type: 'number', initialValue: 0 }),
    defineField({
      name: 'paymentMethod',
      title: 'Payment Method',
      type: 'string',
      options: { list: ['wallet', 'card', 'transfer'] },
    }),
    defineField({ name: 'paymentReference', title: 'Payment Reference', type: 'string' }),
    defineField({
      name: 'status',
      title: 'Order Status',
      type: 'string',
      options: { list: ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'] },
      initialValue: 'pending',
    }),
    defineField({
      name: 'shippingAddress',
      title: 'Shipping Address',
      type: 'object',
      fields: [
        { name: 'fullName', type: 'string', title: 'Full Name' },
        { name: 'address', type: 'string', title: 'Address' },
        { name: 'city', type: 'string', title: 'City' },
        { name: 'state', type: 'string', title: 'State' },
        { name: 'phone', type: 'string', title: 'Phone' },
      ],
    }),
    defineField({
      name: 'discountCode',
      title: 'Discount Code Used',
      type: 'reference',
      to: [{ type: 'discountCode' }],
    }),
    defineField({ name: 'notes', title: 'Notes', type: 'text' }),
    defineField({ name: 'createdAt', title: 'Created At', type: 'datetime' }),
  ],
  preview: {
    select: { title: 'orderNumber', subtitle: 'customer.fullName', status: 'status' },
    prepare({ title, subtitle, status }) {
      return { title: `Order #${title}`, subtitle: `${subtitle} — ${status}` }
    },
  },
})
