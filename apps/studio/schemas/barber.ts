import { defineField, defineType } from 'sanity'

export const barber = defineType({
  name: 'barber',
  title: 'Stylist',
  type: 'document',
  fields: [
    defineField({ name: 'name', title: 'Name', type: 'string', validation: (r) => r.required() }),
    defineField({ name: 'photo', title: 'Photo', type: 'image', options: { hotspot: true } }),
    defineField({ name: 'bio', title: 'Bio', type: 'text', rows: 3 }),
    defineField({ name: 'specialties', title: 'Specialties', type: 'array', of: [{ type: 'string' }] }),
    defineField({ name: 'rating', title: 'Rating', type: 'number', validation: (r) => r.min(0).max(5) }),
    defineField({ name: 'totalReviews', title: 'Total Reviews', type: 'number', initialValue: 0 }),
    defineField({ name: 'isAvailable', title: 'Available', type: 'boolean', initialValue: true }),
    defineField({
      name: 'workingHours',
      title: 'Working Hours',
      type: 'object',
      fields: [
        { name: 'start', title: 'Start Time', type: 'string' },
        { name: 'end', title: 'End Time', type: 'string' },
      ],
    }),
    defineField({
      name: 'workingDays',
      title: 'Working Days',
      type: 'array',
      of: [{ type: 'string' }],
      options: {
        list: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      },
    }),
    defineField({
      name: 'stylist',
      title: 'Stylist Account',
      type: 'reference',
      to: [{ type: 'stylist' }],
      readOnly: true,
      description: 'Set when a Cutty Pro stylist is approved; their profile and availability sync from the app.',
    }),
    defineField({
      name: 'weeklyAvailability',
      title: 'Weekly Availability',
      type: 'array',
      readOnly: true,
      of: [
        {
          type: 'object',
          fields: [
            { name: 'day', type: 'string' },
            { name: 'start', type: 'string' },
            { name: 'end', type: 'string' },
          ],
        },
      ],
    }),
    defineField({ name: 'timeOff', title: 'Days Off', type: 'array', of: [{ type: 'date' }], readOnly: true }),
  ],
  preview: {
    select: { title: 'name', media: 'photo' },
  },
})
