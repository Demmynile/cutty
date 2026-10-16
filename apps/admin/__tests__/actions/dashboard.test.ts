import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sanity } from '../helpers/sanity'

vi.mock('@/lib/server/sanity', async () => (await import('../helpers/sanity')).sanityModule)
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/server/adminAuth', () => ({ requireAdmin: vi.fn() }))
vi.mock('@/lib/server/audit', () => ({ audit: vi.fn() }))
vi.mock('@/lib/server/orders', () => ({ markOrderPaid: vi.fn() }))
vi.mock('@/lib/server/stylists', () => ({ syncBarber: vi.fn() }))
vi.mock('@/lib/server/paystack', () => ({ createSubaccount: vi.fn(async () => 'ACCT_new') }))
vi.mock('@/lib/server/stylistStats', () => ({ marketplaceSettings: vi.fn(async () => ({ commissionPercent: 12 })) }))

const { advanceOrderStatus } = await import('@/app/(dashboard)/actions')
const { reviewShop, reviewStylist, setSuspended } = await import('@/app/(dashboard)/stylists/actions')
const { revalidatePath } = await import('next/cache')
const { requireAdmin } = await import('@/lib/server/adminAuth')
const { audit } = await import('@/lib/server/audit')
const { markOrderPaid } = await import('@/lib/server/orders')
const { syncBarber } = await import('@/lib/server/stylists')
const { createSubaccount } = await import('@/lib/server/paystack')

const OWNER = { id: 'a1', email: 'owner@cutty.app', name: 'O', role: 'owner' as const }
const STAFF = { ...OWNER, id: 'a2', role: 'staff' as const }

beforeEach(() => {
  sanity.reset()
  vi.mocked(requireAdmin).mockResolvedValue(OWNER)
})

describe('bookings', () => {
  it('admins cannot change a booking: only the stylist accepts it, in the Cutty Pro app', async () => {
    const actions = await import('@/app/(dashboard)/actions')
    expect(actions).not.toHaveProperty('updateBookingStatus')
  })
})

describe('advanceOrderStatus', () => {
  const order = (status: string) => ({ _id: 'o1', _rev: 'r', status, orderNumber: 'CUT-1', customerId: 'c1' })

  it.each([['paid', 'processing'], ['processing', 'shipped'], ['shipped', 'delivered']])('moves %s → %s', async (from, to) => {
    sanity.on('_type == "order"', order(from))
    expect(await advanceOrderStatus('o1')).toEqual({ ok: true })
    expect(sanity.patches()[0]).toMatchObject({ id: 'o1', ifRevisionId: 'r', set: { status: to } })
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin.order_status', details: { from, to } }))
    expect(revalidatePath).toHaveBeenCalledWith('/orders')
  })

  it('lets an owner mark a pending order paid (awarding points)', async () => {
    sanity.on('_type == "order"', order('pending'))
    expect(await advanceOrderStatus('o1')).toEqual({ ok: true })
    expect(markOrderPaid).toHaveBeenCalledWith(expect.objectContaining({ _id: 'o1' }), { markedPaidBy: 'owner@cutty.app' })
  })

  it('stops staff from marking orders paid', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(STAFF)
    sanity.on('_type == "order"', order('pending'))
    expect(await advanceOrderStatus('o1')).toEqual({ ok: false, error: 'Only an owner can mark an order as paid' })
    expect(markOrderPaid).not.toHaveBeenCalled()
  })

  it('reports missing orders and terminal statuses', async () => {
    expect(await advanceOrderStatus('x')).toEqual({ ok: false, error: 'Order not found' })
    sanity.on('_type == "order"', order('delivered'))
    expect(await advanceOrderStatus('o1')).toEqual({ ok: false, error: 'No further status' })
    expect(sanity.writes).toEqual([])
  })
})

describe('stylist review actions', () => {
  const stylist = (over: object = {}) => ({
    _id: 's1', _rev: 'r', email: 's@x', fullName: 'Ada Obi', status: 'pending', sessionVersion: 2,
    shop: { status: 'requested', name: 'Ada Hair', bankCode: '058', accountNumber: '0123456789' }, ...over,
  })

  it('are owner-only', async () => {
    vi.mocked(requireAdmin).mockResolvedValue(STAFF)
    sanity.on('_type == "stylist"', stylist())
    expect(await reviewStylist('s1', 'approve')).toEqual({ ok: false, error: 'Only an owner can review stylists' })
    expect(await setSuspended('s1', true)).toMatchObject({ ok: false })
    expect(await reviewShop('s1', 'approve')).toMatchObject({ ok: false })
    expect(sanity.writes).toEqual([])
  })

  it('approving a profile marks it approved and makes it bookable', async () => {
    sanity.on('_type == "stylist"', stylist())
    expect(await reviewStylist('s1', 'approve', 'Welcome')).toEqual({ ok: true })
    expect(sanity.patches()[0]).toMatchObject({ id: 's1', ifRevisionId: 'r', set: { status: 'approved', approvedBy: 'owner@cutty.app', reviewNote: 'Welcome' } })
    expect(syncBarber).toHaveBeenCalledWith('s1')
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'admin.stylist_approve' }))
    expect(revalidatePath).toHaveBeenCalledWith('/stylists')
  })

  it('rejecting uses a default note and does not create a barber', async () => {
    sanity.on('_type == "stylist"', stylist())
    await reviewStylist('s1', 'reject')
    expect(sanity.patches()[0].set).toEqual({ status: 'rejected', reviewNote: expect.stringMatching(/needs more detail/) })
    expect(syncBarber).not.toHaveBeenCalled()
  })

  it('refuses to re-review an approved or suspended stylist', async () => {
    sanity.on('_type == "stylist"', stylist({ status: 'approved' }))
    expect(await reviewStylist('s1', 'approve')).toEqual({ ok: false, error: 'This stylist is already approved' })
    expect(await reviewStylist('missing', 'approve')).toMatchObject({ ok: false })
  })

  it('suspending bumps the session version (signing them out); reinstating restores approval', async () => {
    sanity.on('_type == "stylist"', stylist({ status: 'approved' }))
    await setSuspended('s1', true)
    expect(sanity.patches()[0].set).toEqual({ status: 'suspended', sessionVersion: 3 })
    await setSuspended('s1', false)
    expect(sanity.patches()[1].set).toEqual({ status: 'approved' })
    expect(syncBarber).toHaveBeenCalledTimes(2)
    expect(vi.mocked(audit).mock.calls.map(([e]) => e.action)).toEqual(['admin.stylist_suspend', 'admin.stylist_reinstate'])
  })

  it('approving a shop creates the Paystack subaccount with the current commission', async () => {
    sanity.on('_type == "stylist"', stylist({ status: 'approved' }))
    expect(await reviewShop('s1', 'approve')).toEqual({ ok: true })
    expect(createSubaccount).toHaveBeenCalledWith({ businessName: 'Ada Hair', bankCode: '058', accountNumber: '0123456789', commissionPercent: 12, email: 's@x' })
    expect(sanity.patches()[0].set).toMatchObject({ 'shop.status': 'approved', 'shop.subaccountCode': 'ACCT_new', 'shop.commissionPercent': 12 })
  })

  it('reopening a shop reuses its existing subaccount', async () => {
    sanity.on('_type == "stylist"', stylist({ status: 'approved', shop: { status: 'suspended', bankCode: '058', accountNumber: '0123456789', subaccountCode: 'ACCT_old' } }))
    await reviewShop('s1', 'approve')
    expect(createSubaccount).not.toHaveBeenCalled()
    expect(sanity.patches()[0].set['shop.subaccountCode']).toBe('ACCT_old')
  })

  it('refuses to approve a shop before the profile or without bank details', async () => {
    sanity.on('_type == "stylist"', stylist())
    expect(await reviewShop('s1', 'approve')).toEqual({ ok: false, error: 'Approve the stylist profile first' })
    sanity.reset()
    sanity.on('_type == "stylist"', stylist({ status: 'approved', shop: { status: 'requested' } }))
    expect(await reviewShop('s1', 'approve')).toEqual({ ok: false, error: 'Shop has no bank account' })
    sanity.reset()
    sanity.on('_type == "stylist"', stylist({ shop: undefined }))
    expect(await reviewShop('s1', 'reject')).toEqual({ ok: false, error: 'No shop request' })
  })

  it.each([['reject', 'rejected'], ['suspend', 'suspended']] as const)('%s sets the shop %s with the note', async (decision, status) => {
    sanity.on('_type == "stylist"', stylist({ status: 'approved' }))
    await reviewShop('s1', decision, 'Blurry photos')
    expect(sanity.patches()[0].set).toMatchObject({ 'shop.status': status, 'shop.reviewNote': 'Blurry photos' })
  })

  it('turns thrown errors into a result', async () => {
    sanity.on('_type == "stylist"', stylist({ status: 'approved' }))
    vi.mocked(createSubaccount).mockRejectedValueOnce(new Error('Paystack: Invalid bank'))
    expect(await reviewShop('s1', 'approve')).toEqual({ ok: false, error: 'Paystack: Invalid bank' })
  })
})
