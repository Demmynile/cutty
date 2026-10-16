import { NextResponse } from 'next/server'
import { route } from '@/lib/server/http'
import { requireCustomer } from '@/lib/server/customerAuth'
import { recommendationsFor } from '@/lib/server/recommendations'

export const runtime = 'nodejs'

export const GET = route(async (req) => {
  const { customerId } = await requireCustomer(req)
  return NextResponse.json(await recommendationsFor(customerId))
})
