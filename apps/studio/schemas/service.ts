import { defineField, defineType } from 'sanity'

export const service = defineType({
  name: 'service',
  title: 'Service',
  type: 'document',
  fields: [
    defineField({ name: 'name', title: 'Service Name', type: 'string', validation: (r) => r.required() }),
    defineField({ name: 'description', title: 'Description', type: 'text' }),
    defineField({ name: 'image', title: 'Image', type: 'image', options: { hotspot: true } }),
    defineField({ name: 'price', title: 'Price (kobo)', type: 'number', validation: (r) => r.required().min(0) }),
    defineField({ name: 'duration', title: 'Duration (minutes)', type: 'number', validation: (r) => r.required().min(5) }),
    defineField({ name: 'pointsEarned', title: 'Loyalty Points Earned', type: 'number', initialValue: 10 }),
    defineField({ name: 'isActive', title: 'Active', type: 'boolean', initialValue: true }),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'string',
      options: { list: ['haircut', 'shave', 'styling', 'treatment', 'combo'] },
    }),
  ],
  preview: {
    select: { title: 'name', subtitle: 'price', media: 'image' },
    prepare({ title, subtitle }) {
      return { title, subtitle: subtitle ? `₦${(subtitle / 100).toLocaleString()}` : '' }
    },
  },
})
