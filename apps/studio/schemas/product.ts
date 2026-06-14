import { defineField, defineType } from 'sanity'

export const product = defineType({
  name: 'product',
  title: 'Product',
  type: 'document',
  fields: [
    defineField({ name: 'name', title: 'Product Name', type: 'string', validation: (r) => r.required() }),
    defineField({ name: 'slug', title: 'Slug', type: 'slug', options: { source: 'name' }, validation: (r) => r.required() }),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'reference',
      to: [{ type: 'category' }],
    }),
    defineField({ name: 'description', title: 'Description', type: 'array', of: [{ type: 'block' }] }),
    defineField({ name: 'images', title: 'Images', type: 'array', of: [{ type: 'image', options: { hotspot: true } }] }),
    defineField({ name: 'price', title: 'Price (kobo)', type: 'number', validation: (r) => r.required().min(0) }),
    defineField({ name: 'compareAtPrice', title: 'Compare At Price (kobo)', type: 'number' }),
    defineField({ name: 'stock', title: 'Stock Quantity', type: 'number', initialValue: 0 }),
    defineField({ name: 'sku', title: 'SKU', type: 'string' }),
    defineField({ name: 'pointsEarned', title: 'Loyalty Points Earned', type: 'number', initialValue: 5 }),
    defineField({ name: 'isFeatured', title: 'Featured Product', type: 'boolean', initialValue: false }),
    defineField({ name: 'isActive', title: 'Active', type: 'boolean', initialValue: true }),
    defineField({
      name: 'tags',
      title: 'Tags',
      type: 'array',
      of: [{ type: 'string' }],
      options: { layout: 'tags' },
    }),
    defineField({ name: 'weight', title: 'Weight (grams)', type: 'number' }),
  ],
  preview: {
    select: { title: 'name', subtitle: 'price', media: 'images.0' },
    prepare({ title, subtitle, media }) {
      return { title, subtitle: subtitle ? `₦${(subtitle / 100).toLocaleString()}` : '', media }
    },
  },
})
