import { NextResponse, type NextRequest } from 'next/server'
import { ADMIN_COOKIE, verifySession } from '@/lib/server/session'

// Every dashboard page requires a valid admin session cookie. API routes are
// excluded here because they authenticate themselves: /api/v1 and /api/ai
// with customer bearer tokens, the Paystack webhook with its signature.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const token = req.cookies.get(ADMIN_COOKIE)?.value
  const session = token ? await verifySession(token, 'admin') : null

  if (pathname === '/login') {
    return session ? NextResponse.redirect(new URL('/dashboard', req.url)) : NextResponse.next()
  }
  if (!session) {
    const res = NextResponse.redirect(new URL('/login', req.url))
    if (token) res.cookies.delete(ADMIN_COOKIE)
    return res
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api/|_next/static|_next/image|favicon.ico|robots.txt).*)'],
}
