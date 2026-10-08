// GROQ used by the customer API (app/api/v1/*). Customer-scoped queries all
// take $customerId from the verified session — never from the request body.

export const CUSTOMER_PUBLIC_FIELDS = `
  _id, uid, fullName, email, phone, avatar, walletBalance,
  loyaltyPoints, totalVisits, tier, paymentMethods, preferredLanguage,
  preferredCurrency, notificationPreferences, isActive, createdAt
`

export const CUSTOMER_BY_ID = `*[_type == "customer" && _id == $customerId][0]{ ${CUSTOMER_PUBLIC_FIELDS} }`

// Server-only: includes the password hash. Never return this projection to a client.
export const CUSTOMER_CREDENTIALS_BY_EMAIL = `*[_type == "customer" && lower(email) == $email && isActive != false][0]{
  _id, _rev, password, sessionVersion
}`

export const CUSTOMER_CREDENTIALS_BY_ID = `*[_type == "customer" && _id == $customerId][0]{
  _id, _rev, password, sessionVersion, isActive
}`

export const CUSTOMER_SESSION_BY_ID = `*[_type == "customer" && _id == $customerId][0]{
  _id, email, isActive, sessionVersion
}`

export const CUSTOMER_EXISTS_BY_EMAIL = `count(*[_type == "customer" && (lower(email) == $email || uid == $uid)])`

export const EXCHANGE_RATES = `*[_type == "settings"][0].exchangeRates`

export const SERVICES_ACTIVE = `*[_type == "service" && isActive == true] | order(_createdAt asc){
  _id, name, description, image, price, duration, pointsEarned, category
}`

export const SERVICES_BY_IDS = `*[_type == "service" && isActive == true && _id in $ids]{
  _id, name, price, duration, pointsEarned
}`

export const BARBERS_AVAILABLE = `*[_type == "barber" && isAvailable == true] | order(name asc){
  _id, name, photo, bio, specialties, rating, totalReviews, workingHours, workingDays
}`

export const BARBER_AVAILABLE_BY_ID = `*[_type == "barber" && isAvailable == true && _id == $id][0]{ _id }`

export const BOOKINGS_BY_CUSTOMER = `*[_type == "booking" && customer._ref == $customerId] | order(bookingDate desc){
  _id, bookingDate, startTime, endTime, status, totalAmount, paymentMethod, pointsEarned,
  barber->{ _id, name, photo },
  services[]->{ _id, name, price, duration }
}`

export const BOOKING_BY_ID_FOR_CUSTOMER = `*[_type == "booking" && _id == $id && customer._ref == $customerId][0]{
  _id, bookingDate, startTime, endTime, status, totalAmount, discountAmount,
  paymentMethod, pointsEarned, notes, cancelReason, review, rating,
  customer->{ _id, fullName, phone },
  barber->{ _id, name, photo },
  services[]->{ _id, name, price, duration },
  discountCode->{ _id, code, type, value }
}`

export const PRODUCTS_ACTIVE = `*[_type == "product" && isActive == true] | order(_createdAt desc){
  _id, name, slug, images, price, compareAtPrice, stock, pointsEarned, isFeatured, tags,
  category->{ _id, name, slug }
}`

export const PRODUCTS_FEATURED = `*[_type == "product" && isActive == true && isFeatured == true][0..5]{
  _id, name, slug, images, price, compareAtPrice, stock, pointsEarned,
  category->{ _id, name }
}`

export const PRODUCT_BY_SLUG = `*[_type == "product" && isActive == true && slug.current == $slug][0]{
  _id, name, slug, description, images, price, compareAtPrice, stock,
  sku, pointsEarned, isFeatured, tags,
  category->{ _id, name, slug }
}`

export const PRODUCTS_BY_IDS = `*[_type == "product" && isActive == true && _id in $ids]{
  _id, name, price, stock, pointsEarned
}`

export const CATEGORIES_ALL = `*[_type == "category"] | order(name asc){
  _id, name, slug, image, description
}`

export const ORDERS_BY_CUSTOMER = `*[_type == "order" && customer._ref == $customerId] | order(createdAt desc){
  _id, orderNumber, status, totalAmount, createdAt, pointsEarned,
  items[]{ quantity, priceAtOrder, productName, product->{ _id, name, images } }
}`

export const LOYALTY_TRANSACTIONS_BY_CUSTOMER = `*[_type == "loyaltyTransaction" && customer._ref == $customerId] | order(createdAt desc)[0..19]{
  _id, type, points, balanceAfter, description, source, createdAt
}`

export const WALLET_TRANSACTIONS_BY_CUSTOMER = `*[_type == "walletTransaction" && customer._ref == $customerId] | order(createdAt desc)[0..19]{
  _id, type, category, amount, balanceAfter, description, status, createdAt
}`

export const DISCOUNT_CODE_BY_CODE = `*[_type == "discountCode" && code == $code && isActive == true][0]{
  _id, _rev, code, type, value, maxDiscountAmount, minOrderAmount,
  applicableTo, pointsCost, maxUses, usedCount, validFrom, validUntil,
  "customerId": customer._ref
}`

export const ADMIN_BY_EMAIL = `*[_type == "adminUser" && lower(email) == $email][0]{
  _id, email, name, role, passwordHash, totpSecret, isActive, sessionVersion
}`

export const ADMIN_SESSION_BY_ID = `*[_type == "adminUser" && _id == $id][0]{
  _id, email, name, role, isActive, sessionVersion
}`
