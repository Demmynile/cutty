import { NextResponse } from 'next/server'
import { route, clientIp, HttpError } from '@/lib/server/http'
import { requireClerkUser } from '@/lib/server/clerk'
import { findStylist } from '@/lib/server/stylistAuth'
import { loadAccount } from '@/lib/server/stylists'
import { rateLimit } from '@/lib/server/rateLimit'
import { audit } from '@/lib/server/audit'

export const runtime = 'nodejs'

// Called by the app after a Clerk sign-in on the Cutty Pro screens. Returns
// the stylist account, or 404 { needsProfile: true } when this Clerk user
// hasn't set up Cutty Pro yet (the app then shows the profile step, which
// posts to /api/v1/pro/auth/register).
export const POST = route(async (req) => {
  const ip = clientIp(req)
  await rateLimit(`pro-session:ip:${ip}`, 60, 15 * 60 * 1000)
  const clerkUserId = await requireClerkUser(req)

  const found = await findStylist(clerkUserId)
  if (!found) return NextResponse.json({ error: 'Set up your Cutty Pro profile to continue.', needsProfile: true }, { status: 404 })

  const stylist = await loadAccount(found.stylistId)
  if (stylist.status === 'suspended') throw new HttpError(403, 'Your Cutty Pro account is suspended. Contact Cutty support.')
  await audit({
    action: found.linked ? 'stylist.link_clerk' : 'stylist.login',
    actor: { type: 'stylist', id: found.stylistId, email: stylist.email },
    ip,
    details: { clerkUserId },
  })
  return NextResponse.json({ stylist })
})
