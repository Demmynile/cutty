import 'server-only'
import { serverClient } from './sanity'
import { HttpError } from './http'
import { verifySession, signSession, CUSTOMER_SESSION_SECONDS } from './session'
import { CUSTOMER_SESSION_BY_ID } from './queries'

export type CustomerSession = { customerId: string; email: string }

// Every customer API route starts here. The customer id comes from the signed
// token, never from the request, so one customer can't act as another.
export async function requireCustomer(req: Request): Promise<CustomerSession> {
  const header = req.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) throw new HttpError(401, 'Please sign in')

  const claims = await verifySession(token, 'customer')
  if (!claims) throw new HttpError(401, 'Your session has expired. Please sign in again.')

  const customer = await serverClient.fetch<{ _id: string; email: string; isActive?: boolean; sessionVersion?: number } | null>(
    CUSTOMER_SESSION_BY_ID,
    { customerId: claims.sub },
  )
  if (!customer || customer.isActive === false || (customer.sessionVersion ?? 0) !== claims.ver) {
    throw new HttpError(401, 'Your session has expired. Please sign in again.')
  }
  return { customerId: customer._id, email: customer.email }
}

export function issueCustomerToken(customerId: string, sessionVersion: number) {
  return signSession({ sub: customerId, typ: 'customer', ver: sessionVersion }, CUSTOMER_SESSION_SECONDS)
}
