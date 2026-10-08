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
import { service } from './service'
import { settings } from './settings'
import { walletTransaction } from './walletTransaction'

export const schemaTypes = [
  customer,
  barber,
  service,
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
]
