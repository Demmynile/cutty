import { defineArrayMember, defineField, defineType } from 'sanity'

export const customer = defineType({
  name: 'customer',
  title: 'Customer',
  type: 'document',
  fields: [
    defineField({ name: 'uid', title: 'Auth UID', type: 'string', validation: (r) => r.required() }),
    defineField({ name: 'fullName', title: 'Full Name', type: 'string', validation: (r) => r.required() }),
    defineField({ name: 'email', title: 'Email', type: 'string', validation: (r) => r.required().email() }),
    defineField({ name: 'phone', title: 'Phone Number', type: 'string' }),
    defineField({ name: 'avatar', title: 'Avatar', type: 'image', options: { hotspot: true } }),
    defineField({
      name: 'password',
      title: 'Password Hash',
      type: 'string',
      hidden: true,
      readOnly: true,
      description: 'scrypt hash (legacy accounts: SHA-256, upgraded on next login). Set and verified only by the admin API server.',
    }),
    defineField({ name: 'sessionVersion', type: 'number', hidden: true, readOnly: true }),
    defineField({ name: 'walletBalance', title: 'Wallet Balance (kobo)', type: 'number', initialValue: 0 }),
    defineField({ name: 'loyaltyPoints', title: 'Loyalty Points', type: 'number', initialValue: 0 }),
    defineField({ name: 'totalVisits', title: 'Total Visits', type: 'number', initialValue: 0 }),
    defineField({
      name: 'tier',
      title: 'Loyalty Tier',
      type: 'string',
      options: { list: ['bronze', 'silver', 'gold', 'platinum'] },
      initialValue: 'bronze',
    }),
    defineField({
      name: 'paymentMethods',
      title: 'Saved Payment Methods',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'paymentMethod',
          fields: [
            defineField({
              name: 'brand',
              title: 'Card Brand',
              type: 'string',
              options: { list: ['visa', 'mastercard', 'verve', 'other'] },
            }),
            defineField({
              name: 'last4',
              title: 'Last 4 Digits',
              type: 'string',
              validation: (r) => r.length(4),
            }),
            defineField({ name: 'expiryMonth', title: 'Expiry Month', type: 'number' }),
            defineField({ name: 'expiryYear', title: 'Expiry Year', type: 'number' }),
            defineField({ name: 'holderName', title: 'Cardholder Name', type: 'string' }),
            defineField({ name: 'isDefault', title: 'Default Method', type: 'boolean', initialValue: false }),
          ],
          preview: {
            select: { brand: 'brand', last4: 'last4' },
            prepare: ({ brand, last4 }: { brand?: string; last4?: string }) => ({
              title: `${brand ? brand.toUpperCase() : 'Card'} •••• ${last4 || '----'}`,
            }),
          },
        }),
      ],
    }),
    defineField({
      name: 'preferredLanguage',
      title: 'Preferred Language',
      type: 'string',
      options: { list: ['en', 'fr', 'yo', 'ha', 'ig'] },
      initialValue: 'en',
    }),
    defineField({
      name: 'preferredCurrency',
      title: 'Preferred Currency',
      type: 'string',
      options: { list: ['NGN', 'USD', 'GBP'] },
      initialValue: 'NGN',
    }),
    defineField({
      name: 'notificationPreferences',
      title: 'Notification Preferences',
      type: 'object',
      fields: [
        defineField({ name: 'push', title: 'Push', type: 'boolean', initialValue: true }),
        defineField({ name: 'email', title: 'Email', type: 'boolean', initialValue: true }),
        defineField({ name: 'sms', title: 'SMS', type: 'boolean', initialValue: false }),
        defineField({ name: 'promos', title: 'Promotions & Offers', type: 'boolean', initialValue: true }),
      ],
    }),
    defineField({ name: 'isActive', title: 'Active', type: 'boolean', initialValue: true }),
    defineField({
      name: 'deletedAt',
      title: 'Deleted At',
      type: 'datetime',
      readOnly: true,
      description: 'Set when the customer deletes their account from the app. Personal data is scrubbed; bookings and orders are kept for records.',
    }),
    defineField({ name: 'createdAt', title: 'Created At', type: 'datetime' }),
  ],
  preview: {
    select: { title: 'fullName', subtitle: 'email', media: 'avatar' },
  },
})
