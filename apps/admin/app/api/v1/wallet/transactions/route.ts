import { NextResponse } from 'next/server'
import { serverClient } from '@/lib/server/sanity'
import { route } from '@/lib/server/http'
import { requireCustomer } from '@/lib/server/customerAuth'
import { WALLET_TRANSACTIONS_BY_CUSTOMER } from '@/lib/server/queries'

export const runtime = 'nodejs'

export const GET = route(async (req) => {
  const { customerId } = await requireCustomer(req)
  return NextResponse.json(await serverClient.fetch(WALLET_TRANSACTIONS_BY_CUSTOMER, { customerId }))
})
