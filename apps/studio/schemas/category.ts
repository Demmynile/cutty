import { defineField, defineType } from 'sanity'

export const category = defineType({
  name: 'category',
  title: 'Product Category',
  type: 'document',
  fields: [
    defineField({ name: 'name', title: 'Name', type: 'string', validation: (r) => r.required() }),
    defineField({ name: 'slug', title: 'Slug', type: 'slug', options: { source: 'name' } }),
    defineField({ name: 'image', title: 'Image', type: 'image', options: { hotspot: true } }),
    defineField({ name: 'description', title: 'Description', type: 'text' }),
  ],
  preview: {
    select: { title: 'name', media: 'image' },
  },
})
