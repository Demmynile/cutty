import { NextResponse } from 'next/server'
import { z } from 'zod'
import { serverClient, now } from '@/lib/server/sanity'
import { route, parseBody, HttpError } from '@/lib/server/http'
import { requireStylist } from '@/lib/server/stylistAuth'
import { rateLimit } from '@/lib/server/rateLimit'
import { audit } from '@/lib/server/audit'
import { listBanks, resolveAccount } from '@/lib/server/paystack'
import { loadAccount } from '@/lib/server/stylists'

export const runtime = 'nodejs'

const schema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(500).optional(),
  bankCode: z.string().min(2).max(10),
  accountNumber: z.string().regex(/^\d{10}$/),
})

// Asks Cutty to open the stylist's shop. The bank account is verified with
// Paystack now; the split-payment subaccount is created when an admin
// approves (app/(dashboard)/stylists/actions.ts).
export const POST = route(async (req) => {
  const { stylistId, email, status, shopStatus } = await requireStylist(req)
  if (status !== 'approved') throw new HttpError(403, 'Your profile must be approved before you can open a shop.')
  if (shopStatus === 'approved') throw new HttpError(409, 'Your shop is already open.')
  if (shopStatus === 'suspended') throw new HttpError(403, 'Your shop is suspended. Contact Cutty support.')
  await rateLimit(`pro-shop:${stylistId}`, 5, 60 * 60 * 1000)
  const body = await parseBody(req, schema)

  const bank = (await listBanks()).find((b) => b.code === body.bankCode)
  if (!bank) throw new HttpError(400, 'Unknown bank')
  const accountName = await resolveAccount(body.accountNumber, body.bankCode)

  await serverClient
    .patch(stylistId)
    .set({
      shop: {
        status: 'requested',
        name: body.name,
        description: body.description,
        bankCode: bank.code,
        bankName: bank.name,
        accountNumber: body.accountNumber,
        accountName,
        requestedAt: now(),
      },
    })
    .commit()
  await audit({ action: 'stylist.shop_request', actor: { type: 'stylist', id: stylistId, email }, details: { bank: bank.name } })
  return NextResponse.json(await loadAccount(stylistId))
})
