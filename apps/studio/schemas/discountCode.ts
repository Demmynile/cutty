import { defineField, defineType } from 'sanity'

export const discountCode = defineType({
  name: 'discountCode',
  title: 'Discount Code',
  type: 'document',
  fields: [
    defineField({ name: 'code', title: 'Code', type: 'string', validation: (r) => r.required() }),
    defineField({
      name: 'type',
      title: 'Discount Type',
      type: 'string',
      options: { list: ['percentage', 'fixed'] },
      validation: (r) => r.required(),
    }),
    defineField({ name: 'value', title: 'Discount Value', type: 'number', validation: (r) => r.required().min(0) }),
    defineField({ name: 'maxDiscountAmount', title: 'Max Discount Amount (kobo)', type: 'number' }),
    defineField({ name: 'minOrderAmount', title: 'Minimum Order Amount (kobo)', type: 'number', initialValue: 0 }),
    defineField({
      name: 'applicableTo',
      title: 'Applicable To',
      type: 'string',
      options: { list: ['booking', 'order', 'both'] },
      initialValue: 'both',
    }),
    defineField({ name: 'pointsCost', title: 'Points Cost (to redeem)', type: 'number', initialValue: 0 }),
    defineField({
      name: 'customer',
      title: 'Specific Customer (leave blank for public)',
      type: 'reference',
      to: [{ type: 'customer' }],
    }),
    defineField({ name: 'maxUses', title: 'Max Uses', type: 'number' }),
    defineField({ name: 'usedCount', title: 'Times Used', type: 'number', initialValue: 0 }),
    defineField({ name: 'validFrom', title: 'Valid From', type: 'datetime' }),
    defineField({ name: 'validUntil', title: 'Valid Until', type: 'datetime' }),
    defineField({ name: 'isActive', title: 'Active', type: 'boolean', initialValue: true }),
    defineField({ name: 'createdAt', title: 'Created At', type: 'datetime' }),
  ],
  preview: {
    select: { title: 'code', subtitle: 'type', value: 'value' },
    prepare({ title, subtitle, value }) {
      return { title, subtitle: subtitle === 'percentage' ? `${value}% off` : `₦${(value / 100).toLocaleString()} off` }
    },
  },
})
