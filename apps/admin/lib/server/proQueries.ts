// GROQ for Cutty Pro (stylist) routes and the customer-facing stylist
// directory. Stylist-scoped queries take $stylistId from the verified token.

export const STYLIST_SESSION_BY_CLERK_ID = `*[_type == "stylist" && clerkUserId == $clerkUserId][0]{
  _id, email, isActive, status, "shopStatus": coalesce(shop.status, "none"), "barberId": barber._ref
}`

// A pre-Clerk stylist account that a signed-in Clerk user (same verified email) can claim.
export const STYLIST_LINKABLE_BY_EMAIL = `*[_type == "stylist" && lower(email) == $email && isActive != false][0]{
  _id, _rev, clerkUserId
}`

// Raw account incl. the full bank account number — mask before returning
// (lib/server/stylists.ts → toAccount).
export const STYLIST_ACCOUNT_RAW = `*[_type == "stylist" && _id == $id][0]{
  _id, _type, fullName, displayName, email, phone, kind, photo, bio, yearsExperience,
  "skills": coalesce(skills, []), "styles": coalesce(styles, []),
  "weeklyAvailability": coalesce(weeklyAvailability, []), "timeOff": coalesce(timeOff, []),
  "status": coalesce(status, "pending"), reviewNote, "barberId": barber._ref,
  shop, rating, totalReviews, bookingPrice, "bookingDuration": coalesce(bookingDuration, 60), createdAt,
  "location": select(defined(location.point) => { "lat": location.point.lat, "lng": location.point.lng, "area": location.area, "address": location.address, "city": location.city, "state": location.state, "postcode": location.postcode }),
  "awayAssistant": { "enabled": coalesce(awayAssistant.enabled, false), "notes": awayAssistant.notes }
}`

const PUBLIC_FIELDS = `
  _id, "name": coalesce(displayName, fullName), kind, photo, bio, yearsExperience,
  "skills": coalesce(skills, []), "styles": coalesce(styles, []),
  "weeklyAvailability": coalesce(weeklyAvailability, []),
  rating, totalReviews, "barberId": barber._ref, bookingPrice, "bookingDuration": coalesce(bookingDuration, 60),
  "hasShop": shop.status == "approved", "shopName": shop.name,
  "location": select(defined(location.point) => { "lat": location.point.lat, "lng": location.point.lng, "area": location.area, "address": location.address, "city": location.city, "state": location.state, "postcode": location.postcode })
`

export const STYLISTS_PUBLIC = `*[_type == "stylist" && status == "approved" && isActive != false && defined(barber)] | order(coalesce(rating, 0) desc, _createdAt asc){
  ${PUBLIC_FIELDS}
}`

export const STYLIST_PUBLIC_BY_ID = `*[_type == "stylist" && _id == $id && status == "approved" && isActive != false][0]{
  ${PUBLIC_FIELDS},
  "products": select(shop.status == "approved" => *[_type == "product" && seller._ref == ^._id && isActive == true] | order(_createdAt desc){
    _id, name, slug, images, price, compareAtPrice, stock, pointsEarned, isFeatured, tags,
    "seller": seller->{ _id, "name": coalesce(shop.name, displayName, fullName) }
  }, [])
}`

// ─── Stylist's own catalogue ──────────────────────────────────────────────

export const PRO_PRODUCTS = `*[_type == "product" && seller._ref == $stylistId] | order(_createdAt desc){
  _id, name, slug, description, images, price, compareAtPrice, stock, sku, pointsEarned, isActive, tags,
  category->{ _id, name, slug }
}`

export const PRO_PRODUCT_BY_ID = `*[_type == "product" && _id == $id && seller._ref == $stylistId][0]{ _id, _rev }`

// ─── Bookings & sales ─────────────────────────────────────────────────────

export const PRO_BOOKINGS = `*[_type == "booking" && barber._ref == $barberId && ($status == "all" || status == $status)] | order(bookingDate desc, startTime desc)[0...100]{
  _id, bookingDate, startTime, endTime, status, totalAmount, discountAmount, notes, pointsEarned, createdAt,
  "customer": customer->{ _id, fullName, phone, avatar, tier },
  style
}`

export const PRO_SALES = `*[_type == "order" && seller._ref == $stylistId && ($status == "all" || status == $status)] | order(createdAt desc)[0...100]{
  _id, orderNumber, status, paymentMethod, totalAmount, createdAt, shippingAddress,
  "customerName": customer->fullName,
  "items": items[]{ productName, quantity, priceAtOrder }
}`

export const PRO_SALE_BY_ID = `*[_type == "order" && _id == $id && seller._ref == $stylistId][0]{
  _id, _rev, status, orderNumber, paymentMethod, "pointsEarned": coalesce(pointsEarned, 0), "customerId": customer._ref
}`

// ─── Conversations ────────────────────────────────────────────────────────

const CONVERSATION_FIELDS = `
  _id, lastMessageAt, lastMessagePreview,
  "customer": customer->{ _id, "name": fullName, avatar },
  "stylist": stylist->{ _id, "name": coalesce(displayName, fullName), photo }
`

export const CONVERSATIONS_FOR_CUSTOMER = `*[_type == "conversation" && customer._ref == $customerId] | order(coalesce(lastMessageAt, createdAt) desc)[0...50]{
  ${CONVERSATION_FIELDS}, "unread": coalesce(customerUnread, 0)
}`

export const CONVERSATIONS_FOR_STYLIST = `*[_type == "conversation" && stylist._ref == $stylistId] | order(coalesce(lastMessageAt, createdAt) desc)[0...50]{
  ${CONVERSATION_FIELDS}, "unread": coalesce(stylistUnread, 0)
}`

export const CONVERSATION_BY_PAIR = `*[_type == "conversation" && customer._ref == $customerId && stylist._ref == $stylistId][0]{ ${CONVERSATION_FIELDS}, "unread": 0 }`

export const CONVERSATION_PARTICIPANTS = `*[_type == "conversation" && _id == $id][0]{
  _id, _rev, "customerId": customer._ref, "stylistId": stylist._ref
}`

// Opening a thread in one round trip: who's in it, its unread counts and a
// page of messages. $before is an ISO date; pass "9999" for the newest page.
export const THREAD_PAGE = `*[_type == "conversation" && _id == $id][0]{
  _id, "customerId": customer._ref, "stylistId": stylist._ref,
  "customerUnread": coalesce(customerUnread, 0), "stylistUnread": coalesce(stylistUnread, 0),
  "messages": *[_type == "chatMessage" && conversation._ref == ^._id && createdAt < $before] | order(createdAt desc)[0...50]{
    _id, "conversationId": conversation._ref, senderType, senderId, text, clientId, createdAt
  }
}`
