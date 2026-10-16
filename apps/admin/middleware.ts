import { NextResponse, type NextRequest } from 'next/server'
import { FEATURES } from '@cutty/types'
import { ADMIN_COOKIE, verifySession } from '@/lib/server/session'

// Shop endpoints and dashboard pages, switched off while FEATURES.shop is false
// (planned for v2.0). Kept in sync with the shop entries in `config.matcher`.
const SHOP_API = ['/api/v1/orders', '/api/v1/catalog/products', '/api/v1/pro/shop', '/api/v1/pro/products', '/api/v1/pro/sales']
const SHOP_PAGES = ['/products', '/orders']
const under = (pathname: string, prefixes: string[]) => prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))

// Every dashboard page requires a valid admin session cookie. API routes are
// excluded here because they authenticate themselves: /api/v1 and /api/ai
// with customer bearer tokens, the Paystack webhook with its signature.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (!FEATURES.shop && under(pathname, SHOP_API)) {
    return NextResponse.json({ error: 'The shop is not available yet.' }, { status: 404 })
  }
  if (pathname.startsWith('/api/')) return NextResponse.next()

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
  if (!FEATURES.shop && under(pathname, SHOP_PAGES)) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api/|_next/static|_next/image|favicon.ico|robots.txt).*)',
    '/api/v1/orders/:path*',
    '/api/v1/catalog/products/:path*',
    '/api/v1/pro/shop/:path*',
    '/api/v1/pro/products/:path*',
    '/api/v1/pro/sales/:path*',
  ],
}
