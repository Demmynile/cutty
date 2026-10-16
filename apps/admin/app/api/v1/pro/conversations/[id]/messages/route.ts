import { NextResponse } from 'next/server'
import { route } from '@/lib/server/http'
import { requireStylist } from '@/lib/server/stylistAuth'
import { threadPage } from '@/lib/server/chat'

export const runtime = 'nodejs'

// History (newest 50, or older than ?before=). Opening a thread clears the
// stylist's unread count. New messages arrive over the socket.
export const GET = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { stylistId } = await requireStylist(req, { approved: true })
  const before = new URL(req.url).searchParams.get('before') || '9999'
  return NextResponse.json(await threadPage((await params).id, { type: 'stylist', id: stylistId }, before))
})
