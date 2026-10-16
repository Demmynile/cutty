// GROQ used by the customer API (app/api/v1/*). Customer-scoped queries all
// take $customerId from the verified session — never from the request body.

export const CUSTOMER_PUBLIC_FIELDS = `
  _id, uid, fullName, email, phone, avatar, walletBalance,
  loyaltyPoints, totalVisits, tier, paymentMethods, preferredLanguage,
  preferredCurrency, notificationPreferences, isActive, createdAt
`

export const CUSTOMER_BY_ID = `*[_type == "customer" && _id == $customerId][0]{ ${CUSTOMER_PUBLIC_FIELDS} }`

// Customers sign in with Clerk; clerkUserId links the Clerk user to this record.
export const CUSTOMER_SESSION_BY_CLERK_ID = `*[_type == "customer" && clerkUserId == $clerkUserId][0]{
  _id, email, isActive
}`

// A pre-Clerk account that a newly signed-in Clerk user (same verified email) can claim.
export const CUSTOMER_LINKABLE_BY_EMAIL = `*[_type == "customer" && lower(email) == $email && isActive != false][0]{
  _id, _rev, clerkUserId
}`

export const EXCHANGE_RATES = `*[_type == "settings"][0].exchangeRates`

// Customers book a Cutty Pro stylist (found on the map or in search). Each
// stylist's `barber` record is their calendar; price and length come from
// the stylist, so a booking is only possible once they've set a price.
export const BOOKABLE_STYLIST_BY_BARBER_ID = `*[_type == "stylist" && barber._ref == $id && status == "approved" && isActive != false
  && defined(bookingPrice) && barber->isAvailable == true][0]{
  _id, "styles": coalesce(styles, []), bookingPrice, "bookingDuration": coalesce(bookingDuration, 60)
}`

export const BOOKINGS_BY_CUSTOMER = `*[_type == "booking" && customer._ref == $customerId] | order(bookingDate desc){
  _id, bookingDate, startTime, endTime, status, totalAmount, paymentMethod, pointsEarned,
  barber->{ _id, name, photo },
  style
}`

export const BOOKING_BY_ID_FOR_CUSTOMER = `*[_type == "booking" && _id == $id && customer._ref == $customerId][0]{
  _id, bookingDate, startTime, endTime, status, totalAmount, discountAmount,
  paymentMethod, pointsEarned, notes, cancelReason, review, rating,
  customer->{ _id, fullName, phone },
  barber->{ _id, name, photo },
  style,
  discountCode->{ _id, code, type, value }
}`

// Products from Cutty and from approved stylist shops (a suspended shop's
// products disappear without being edited).
export const PRODUCTS_ACTIVE = `*[_type == "product" && isActive == true && (!defined(seller) || seller->shop.status == "approved")] | order(_createdAt desc){
  _id, name, slug, images, price, compareAtPrice, stock, pointsEarned, isFeatured, tags,
  category->{ _id, name, slug }, "seller": seller->{ _id, "name": coalesce(shop.name, displayName, fullName) }
}`

export const PRODUCTS_FEATURED = `*[_type == "product" && isActive == true && isFeatured == true && (!defined(seller) || seller->shop.status == "approved")][0..5]{
  _id, name, slug, images, price, compareAtPrice, stock, pointsEarned,
  category->{ _id, name }, "seller": seller->{ _id, "name": coalesce(shop.name, displayName, fullName) }
}`

export const PRODUCT_BY_SLUG = `*[_type == "product" && isActive == true && slug.current == $slug && (!defined(seller) || seller->shop.status == "approved")][0]{
  _id, name, slug, description, images, price, compareAtPrice, stock,
  sku, pointsEarned, isFeatured, tags,
  category->{ _id, name, slug }, "seller": seller->{ _id, "name": coalesce(shop.name, displayName, fullName) }
}`

export const PRODUCTS_BY_IDS = `*[_type == "product" && isActive == true && _id in $ids && (!defined(seller) || seller->shop.status == "approved")]{
  _id, name, price, stock, pointsEarned, "sellerId": seller._ref
}`

export const CATEGORIES_ALL = `*[_type == "category"] | order(name asc){
  _id, name, slug, image, description
}`

export const ORDERS_BY_CUSTOMER = `*[_type == "order" && customer._ref == $customerId] | order(createdAt desc){
  _id, orderNumber, status, totalAmount, createdAt, pointsEarned, paymentMethod,
  "seller": seller->{ _id, "name": coalesce(shop.name, displayName, fullName) },
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
  _id, _rev, email, name, role, passwordHash, totpSecret, totpLastStep, isActive, sessionVersion
}`

export const ADMIN_SESSION_BY_ID = `*[_type == "adminUser" && _id == $id][0]{
  _id, email, name, role, isActive, sessionVersion
}`
