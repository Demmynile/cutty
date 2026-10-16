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
    defineField({
      name: 'exchangeRates',
      title: 'Display Exchange Rates',
      description: 'Naira per 1 unit of each currency. Used only to display prices to customers who pick USD/GBP — all payments are still charged in NGN.',
      type: 'object',
      fields: [
        { name: 'USD', title: '₦ per $1', type: 'number', initialValue: 1550 },
        { name: 'GBP', title: '₦ per £1', type: 'number', initialValue: 2050 },
      ],
    }),
    defineField({
      name: 'marketplace',
      title: 'Cutty Pro Marketplace',
      type: 'object',
      fields: [
        { name: 'commissionPercent', title: 'Cutty commission on stylist sales (%)', type: 'number', initialValue: 10, validation: (r) => r.min(0).max(50) },
        { name: 'bonusMaxPerAward', title: 'Max bonus points per award', type: 'number', initialValue: 200 },
        { name: 'bonusMonthlyCap', title: 'Max bonus points a stylist can give per month', type: 'number', initialValue: 2000 },
        { name: 'bookingPointsMaxPerVisit', title: 'Max points per booking a stylist completes', type: 'number', initialValue: 300, validation: (r) => r.min(0) },
        { name: 'bookingPointsMonthlyCap', title: 'Max booking points per stylist per month', type: 'number', initialValue: 5000, validation: (r) => r.min(0) },
      ],
    }),
  ],
})
