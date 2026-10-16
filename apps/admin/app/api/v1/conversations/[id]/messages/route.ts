import { NextResponse } from 'next/server'
import { route } from '@/lib/server/http'
import { requireCustomer } from '@/lib/server/customerAuth'
import { threadPage } from '@/lib/server/chat'

export const runtime = 'nodejs'

export const GET = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { customerId } = await requireCustomer(req)
  const before = new URL(req.url).searchParams.get('before') || '9999'
  return NextResponse.json(await threadPage((await params).id, { type: 'customer', id: customerId }, before))
})
