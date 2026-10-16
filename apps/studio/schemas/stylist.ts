import { defineArrayMember, defineField, defineType } from 'sanity'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

// A barber or braider with their own login in the mobile app ("Cutty Pro").
// They sign up themselves; an admin approves the profile (which creates the
// bookable `barber` record) and, separately, their shop (which creates their
// Paystack subaccount so product sales are split automatically).
export const stylist = defineType({
  name: 'stylist',
  title: 'Stylist Account',
  type: 'document',
  fields: [
    defineField({ name: 'fullName', title: 'Full Name', type: 'string', validation: (r) => r.required() }),
    defineField({ name: 'email', title: 'Email', type: 'string', validation: (r) => r.required().email() }),
    defineField({ name: 'phone', title: 'Phone', type: 'string' }),
    defineField({
      name: 'clerkUserId',
      title: 'Clerk User ID',
      type: 'string',
      readOnly: true,
      description: 'Links this record to the Clerk sign-in (email or Google). Set by the admin API server.',
    }),
    defineField({
      name: 'password',
      title: 'Legacy Password Hash',
      type: 'string',
      hidden: true,
      readOnly: true,
      description: 'Pre-Clerk password hash. Removed when the account is linked to Clerk.',
    }),
    defineField({ name: 'sessionVersion', type: 'number', hidden: true, readOnly: true, description: 'Pre-Clerk session counter. No longer used.' }),
    defineField({
      name: 'kind',
      title: 'Kind',
      type: 'string',
      options: { list: ['barber', 'braider', 'both'] },
      validation: (r) => r.required(),
    }),
    defineField({ name: 'displayName', title: 'Display Name', type: 'string' }),
    defineField({ name: 'photo', title: 'Photo', type: 'image', options: { hotspot: true } }),
    defineField({ name: 'bio', title: 'Bio', type: 'text', rows: 4 }),
    defineField({ name: 'yearsExperience', title: 'Years of Experience', type: 'number', validation: (r) => r.min(0).max(70) }),
    defineField({ name: 'skills', title: 'Skills', type: 'array', of: [{ type: 'string' }], description: 'e.g. Fades, Beard sculpting, Knotless braids' }),
    defineField({
      name: 'styles',
      title: 'Styles',
      type: 'array',
      of: [{ type: 'string' }],
      description: 'Try-on preset ids (e.g. taper-fade) or custom style names this stylist can do.',
    }),
    defineField({
      name: 'bookingPrice',
      title: 'Appointment Price (kobo)',
      type: 'number',
      description: 'What one appointment costs. Customers book the stylist, not a service, so this sets the price, discounts and loyalty points.',
      validation: (r) => r.min(0),
    }),
    defineField({ name: 'bookingDuration', title: 'Appointment Length (minutes)', type: 'number', initialValue: 60, validation: (r) => r.min(15).max(720) }),
    defineField({
      name: 'weeklyAvailability',
      title: 'Weekly Availability',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'availabilityWindow',
          fields: [
            defineField({ name: 'day', type: 'string', options: { list: DAYS }, validation: (r) => r.required() }),
            defineField({ name: 'start', type: 'string', description: 'HH:mm', validation: (r) => r.required().regex(/^\d{2}:\d{2}$/) }),
            defineField({ name: 'end', type: 'string', description: 'HH:mm', validation: (r) => r.required().regex(/^\d{2}:\d{2}$/) }),
          ],
          preview: {
            select: { day: 'day', start: 'start', end: 'end' },
            prepare: ({ day, start, end }: { day?: string; start?: string; end?: string }) => ({ title: `${day ?? '?'} ${start ?? ''}–${end ?? ''}` }),
          },
        }),
      ],
    }),
    defineField({
      name: 'location',
      title: 'Work Location',
      type: 'object',
      description: 'Where customers come for appointments. Shown on the customer map.',
      fields: [
        defineField({ name: 'point', title: 'Map Pin', type: 'geopoint' }),
        defineField({ name: 'area', title: 'Area', type: 'string', description: 'e.g. Lekki Phase 1' }),
        defineField({ name: 'address', title: 'Street Address', type: 'string' }),
        defineField({ name: 'city', title: 'City', type: 'string' }),
        defineField({ name: 'state', title: 'State / County', type: 'string' }),
        defineField({ name: 'postcode', title: 'Postcode', type: 'string' }),
      ],
    }),
    defineField({ name: 'timeOff', title: 'Days Off', type: 'array', of: [{ type: 'date' }] }),
    defineField({
      name: 'status',
      title: 'Profile Status',
      type: 'string',
      options: { list: ['pending', 'approved', 'rejected', 'suspended'] },
      initialValue: 'pending',
      readOnly: true,
    }),
    defineField({ name: 'reviewNote', title: 'Review Note', type: 'text', rows: 2, readOnly: true }),
    defineField({ name: 'barber', title: 'Bookable Profile', type: 'reference', to: [{ type: 'barber' }], readOnly: true }),
    defineField({
      name: 'shop',
      title: 'Shop',
      type: 'object',
      readOnly: true,
      fields: [
        defineField({ name: 'status', type: 'string', options: { list: ['none', 'requested', 'approved', 'rejected', 'suspended'] }, initialValue: 'none' }),
        defineField({ name: 'name', type: 'string' }),
        defineField({ name: 'description', type: 'text', rows: 3 }),
        defineField({ name: 'bankCode', type: 'string' }),
        defineField({ name: 'bankName', type: 'string' }),
        defineField({ name: 'accountNumber', type: 'string' }),
        defineField({ name: 'accountName', type: 'string' }),
        defineField({ name: 'subaccountCode', title: 'Paystack Subaccount', type: 'string' }),
        defineField({ name: 'commissionPercent', title: 'Cutty Commission %', type: 'number' }),
        defineField({ name: 'requestedAt', type: 'datetime' }),
        defineField({ name: 'reviewedAt', type: 'datetime' }),
        defineField({ name: 'reviewNote', type: 'text', rows: 2 }),
      ],
    }),
    defineField({ name: 'rating', title: 'Rating', type: 'number', readOnly: true }),
    defineField({ name: 'totalReviews', title: 'Total Reviews', type: 'number', readOnly: true }),
    defineField({
      name: 'awayAssistant',
      title: 'Away Assistant',
      type: 'object',
      description: 'Cutty AI replies to customers while the stylist is offline. Text only: it never books, cancels or changes anything.',
      fields: [
        defineField({ name: 'enabled', title: 'On', type: 'boolean', initialValue: false }),
        defineField({ name: 'notes', title: 'What it should know', type: 'text', rows: 5, validation: (r) => r.max(2000) }),
      ],
    }),
    defineField({ name: 'isActive', title: 'Active', type: 'boolean', initialValue: true }),
    defineField({ name: 'approvedAt', type: 'datetime', readOnly: true }),
    defineField({ name: 'lastBonusAt', type: 'datetime', readOnly: true, description: 'Set with each loyalty bonus; serialises awards against the monthly cap.' }),
    defineField({ name: 'approvedBy', type: 'string', readOnly: true }),
    defineField({ name: 'createdAt', title: 'Created At', type: 'datetime', readOnly: true }),
  ],
  preview: {
    select: { title: 'fullName', subtitle: 'status', media: 'photo' },
  },
})
