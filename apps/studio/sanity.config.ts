import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { visionTool } from '@sanity/vision'
import { schemaTypes } from './schemas'

export default defineConfig({
  name: 'cutty-studio',
  title: 'Cutty Barbershop & Salon Studio',
  projectId: process.env.SANITY_STUDIO_PROJECT_ID!,
  dataset: process.env.SANITY_STUDIO_DATASET || 'production',
  plugins: [
    structureTool({
      structure: (S) =>
        S.list()
          .title('Cutty Admin')
          .items([
            S.listItem().title('Bookings').child(S.documentTypeList('booking')),
            S.listItem().title('Services').child(S.documentTypeList('service')),
            S.listItem().title('Stylists').child(S.documentTypeList('barber')),
            S.divider(),
            S.listItem().title('Products').child(S.documentTypeList('product')),
            S.listItem().title('Categories').child(S.documentTypeList('category')),
            S.listItem().title('Orders').child(S.documentTypeList('order')),
            S.divider(),
            S.listItem().title('Customers').child(S.documentTypeList('customer')),
            S.listItem().title('Wallet Transactions').child(S.documentTypeList('walletTransaction')),
            S.listItem().title('Loyalty Transactions').child(S.documentTypeList('loyaltyTransaction')),
            S.listItem().title('Discount Codes').child(S.documentTypeList('discountCode')),
            S.divider(),
            S.listItem().title('Settings').child(S.documentTypeList('settings')),
          ]),
    }),
    visionTool(),
  ],
  schema: {
    types: schemaTypes,
  },
})
