import { adminUser } from './adminUser'
import { auditLog } from './auditLog'
import { barber } from './barber'
import { booking } from './booking'
import { category } from './category'
import { customer } from './customer'
import { discountCode } from './discountCode'
import { loyaltyTransaction } from './loyaltyTransaction'
import { order } from './order'
import { product } from './product'
import { settings } from './settings'
import { walletTransaction } from './walletTransaction'
import { stylist } from './stylist'
import { conversation, chatMessage } from './conversation'
import { aiSearch } from './aiSearch'
import { waitlistEntry } from './waitlistEntry'

export const schemaTypes = [
  customer,
  barber,
  booking,
  category,
  product,
  order,
  loyaltyTransaction,
  walletTransaction,
  discountCode,
  settings,
  adminUser,
  auditLog,
  stylist,
  conversation,
  chatMessage,
  aiSearch,
  waitlistEntry,
]
