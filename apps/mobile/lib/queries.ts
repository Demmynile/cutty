export const CUSTOMER_BY_UID = `*[_type == "customer" && uid == $uid][0]{
  _id, uid, fullName, email, phone, avatar, walletBalance,
  loyaltyPoints, totalVisits, tier, isActive, createdAt
}`

export const SERVICES_ACTIVE = `*[_type == "service" && isActive == true] | order(_createdAt asc){
  _id, name, description, image, price, duration, pointsEarned, category
}`

export const BARBERS_AVAILABLE = `*[_type == "barber" && isAvailable == true] | order(name asc){
  _id, name, photo, bio, specialties, rating, totalReviews, workingHours, workingDays
}`

export const BOOKINGS_BY_CUSTOMER = `*[_type == "booking" && customer._ref == $customerId] | order(bookingDate desc){
  _id, bookingDate, startTime, endTime, status, totalAmount, paymentMethod, pointsEarned,
  barber->{ _id, name, photo },
  services[]->{ _id, name, price, duration }
}`

export const BOOKING_BY_ID = `*[_type == "booking" && _id == $id][0]{
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

export const PRODUCT_BY_SLUG = `*[_type == "product" && slug.current == $slug][0]{
  _id, name, slug, description, images, price, compareAtPrice, stock,
  sku, pointsEarned, isFeatured, tags,
  category->{ _id, name, slug }
}`

export const PRODUCTS_BY_CATEGORY = `*[_type == "product" && isActive == true && category._ref == $categoryId] | order(_createdAt desc){
  _id, name, slug, images, price, compareAtPrice, stock, pointsEarned,
  category->{ _id, name }
}`

export const CATEGORIES_ALL = `*[_type == "category"] | order(name asc){
  _id, name, slug, image, description
}`

export const ORDERS_BY_CUSTOMER = `*[_type == "order" && customer._ref == $customerId] | order(createdAt desc){
  _id, orderNumber, status, totalAmount, createdAt, pointsEarned,
  items[]{ quantity, priceAtOrder, productName, product->{ _id, name, images } }
}`

export const ORDER_BY_ID = `*[_type == "order" && _id == $id][0]{
  _id, orderNumber, status, subtotal, discountAmount, shippingFee, totalAmount,
  paymentMethod, paymentReference, createdAt, notes, shippingAddress, pointsEarned,
  customer->{ _id, fullName, phone },
  items[]{ quantity, priceAtOrder, productName, product->{ _id, name, images } },
  discountCode->{ _id, code, type, value }
}`

export const LOYALTY_TRANSACTIONS_BY_CUSTOMER = `*[_type == "loyaltyTransaction" && customer._ref == $customerId] | order(createdAt desc)[0..19]{
  _id, type, points, balanceAfter, description, source, createdAt
}`

export const WALLET_TRANSACTIONS_BY_CUSTOMER = `*[_type == "walletTransaction" && customer._ref == $customerId] | order(createdAt desc)[0..19]{
  _id, type, category, amount, balanceAfter, description, status, createdAt
}`

export const DISCOUNT_CODE_BY_CODE = `*[_type == "discountCode" && code == $code && isActive == true][0]{
  _id, code, type, value, maxDiscountAmount, minOrderAmount,
  applicableTo, pointsCost, maxUses, usedCount, validFrom, validUntil,
  customer->{ _id }
}`

export const SETTINGS = `*[_type == "settings"][0]{
  shopName, logo, address, phone, email, openingTime, closingTime,
  closedDays, bookingSlotInterval, loyaltyPointsPerNaira, pointsToNairaRate,
  tierThresholds, currency
}`
