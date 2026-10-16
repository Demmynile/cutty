import { NextResponse } from 'next/server'
import { z } from 'zod'
import { route, parseBody } from '@/lib/server/http'
import { requireStylist } from '@/lib/server/stylistAuth'
import { rateLimit } from '@/lib/server/rateLimit'
import { listBanks, resolveAccount } from '@/lib/server/paystack'

export const runtime = 'nodejs'

export const GET = route(async (req) => {
  await requireStylist(req)
  return NextResponse.json(await listBanks())
})

// Confirms the account holder's name before the stylist submits a shop request.
export const POST = route(async (req) => {
  const { stylistId } = await requireStylist(req)
  await rateLimit(`pro-resolve:${stylistId}`, 10, 15 * 60 * 1000)
  const { accountNumber, bankCode } = await parseBody(req, z.object({ accountNumber: z.string().regex(/^\d{10}$/), bankCode: z.string().min(2).max(10) }))
  return NextResponse.json({ accountName: await resolveAccount(accountNumber, bankCode) })
})
