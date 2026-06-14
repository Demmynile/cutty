import { defineField, defineType } from 'sanity'

export const settings = defineType({
  name: 'settings',
  title: 'Shop Settings',
  type: 'document',
  fields: [
    defineField({ name: 'shopName', title: 'Shop Name', type: 'string' }),
    defineField({ name: 'logo', title: 'Logo', type: 'image', options: { hotspot: true } }),
    defineField({ name: 'address', title: 'Address', type: 'text' }),
    defineField({ name: 'phone', title: 'Phone', type: 'string' }),
    defineField({ name: 'email', title: 'Email', type: 'string' }),
    defineField({ name: 'openingTime', title: 'Opening Time', type: 'string' }),
    defineField({ name: 'closingTime', title: 'Closing Time', type: 'string' }),
    defineField({
      name: 'closedDays',
      title: 'Closed Days',
      type: 'array',
      of: [{ type: 'string' }],
      options: { list: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
    }),
    defineField({ name: 'bookingSlotInterval', title: 'Booking Slot Interval (minutes)', type: 'number', initialValue: 30 }),
    defineField({ name: 'loyaltyPointsPerNaira', title: 'Points Earned Per ₦100 Spent', type: 'number', initialValue: 1 }),
    defineField({ name: 'pointsToNairaRate', title: 'Points to ₦ Rate (100 points = ?kobo)', type: 'number', initialValue: 5000 }),
    defineField({
      name: 'tierThresholds',
      title: 'Loyalty Tier Thresholds',
      type: 'object',
      fields: [
        { name: 'silver', title: 'Silver (visits)', type: 'number', initialValue: 5 },
        { name: 'gold', title: 'Gold (visits)', type: 'number', initialValue: 15 },
        { name: 'platinum', title: 'Platinum (visits)', type: 'number', initialValue: 30 },
      ],
    }),
    defineField({ name: 'paystackPublicKey', title: 'Paystack Public Key', type: 'string' }),
    defineField({ name: 'currency', title: 'Currency', type: 'string', initialValue: 'NGN' }),
  ],
})
