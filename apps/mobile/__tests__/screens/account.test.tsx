// @vitest-environment jsdom
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { router, setParams } from '../stubs/expo-router'
import { Alert, Linking, renderedLists } from '../stubs/react-native'
import { useUser } from '../stubs/clerk-expo'
import { pressAlertButton, renderScreen } from '../helpers/screen'
import { routeApi, sent } from '../helpers/api'

vi.mock('@/lib/api', async (orig) => ({ ...(await orig<typeof import('@/lib/api')>()), api: vi.fn() }))
vi.mock('@/lib/realtime', () => ({ disconnectRealtime: vi.fn(), useMessageListener: vi.fn(), useConversation: vi.fn() }))
vi.mock('@/lib/auth', async (orig) => ({ ...(await orig<typeof import('@/lib/auth')>()), clearAuthData: vi.fn() }))

const { api, ApiError } = await import('@/lib/api')
const { useConversation } = await import('@/lib/realtime')
const { useAuthStore } = await import('@/store/authStore')
const { useAIChatStore } = await import('@/store/aiChatStore')
const { useCartStore } = await import('@/store/cartStore')
const { useThemeStore } = await import('@/store/themeStore')

const alert = vi.mocked(Alert.alert)
const customer = {
  _id: 'c1', fullName: 'Ada Obi', email: 'ada@x.io', phone: '08012345678', preferredLanguage: 'en', preferredCurrency: 'NGN',
  notificationPreferences: { push: true, email: true, sms: false, promos: true },
}

beforeEach(() => {
  setParams({})
  useAuthStore.setState({ customer: customer as never, stylist: null, role: 'customer', isAuthenticated: true })
})

describe('settings', () => {
  beforeEach(() => routeApi(api, { 'PATCH /api/v1/me': {}, 'DELETE /api/v1/me': { ok: true } }))

  it('links to account pages and support', async () => {
    const { default: Settings } = await import('@/app/settings')
    const s = await renderScreen(<Settings />)
    for (const [label, route] of [['Edit Profile', '/edit-profile'], ['Change Password', '/change-password'], ['Payment Methods', '/payment-methods'], ['Help & Support', '/support']]) {
      await s.press(label)
      expect(router.push).toHaveBeenLastCalledWith(route)
    }
  })

  it('switches the theme', async () => {
    const { default: Settings } = await import('@/app/settings')
    const s = await renderScreen(<Settings />)
    await s.press(/^Light$/)
    expect(useThemeStore.getState().mode).toBe('light')
    await s.press(/^System$/)
    expect(useThemeStore.getState().mode).toBe('system')
  })

  it('toggles notifications optimistically and rolls back on failure', async () => {
    const { default: Settings } = await import('@/app/settings')
    const s = await renderScreen(<Settings />)
    const [, , sms] = s.switches()
    expect(sms.checked).toBe(false)
    await s.press(sms)
    expect(sent(api, 'PATCH /api/v1/me')).toEqual([{ notificationPreferences: { push: true, email: true, sms: true, promos: true } }])
    expect(useAuthStore.getState().customer!.notificationPreferences!.sms).toBe(true)

    routeApi(api, { 'PATCH /api/v1/me': new ApiError(0, 'offline') })
    await s.press(s.switches()[0])
    expect(useAuthStore.getState().customer!.notificationPreferences!.push).toBe(true)
    expect(alert).toHaveBeenLastCalledWith('Error', expect.stringContaining('Could not save'))
  })

  it('changes language and currency, skipping no-op selections', async () => {
    const { default: Settings } = await import('@/app/settings')
    const s = await renderScreen(<Settings />)
    await s.press('LanguageEnglish')
    await s.press(/^English$/)
    expect(api).not.toHaveBeenCalled()
    await s.press('LanguageEnglish')
    await s.press(/^Yoruba$/)
    await s.press('CurrencyNGN')
    await s.press('British Pound (£)')
    expect(sent(api, 'PATCH /api/v1/me')).toEqual([{ preferredLanguage: 'yo' }, { preferredCurrency: 'GBP' }])
    expect(s.text()).toContain('LanguageYoruba')
    expect(s.text()).toContain('CurrencyGBP')
  })

  it('clears AI chat history after confirmation', async () => {
    useAIChatStore.getState().clearAll()
    const { default: Settings } = await import('@/app/settings')
    const empty = await renderScreen(<Settings />)
    expect(empty.button('Clear AI Chat History').disabled).toBe(true)

    useAIChatStore.getState().addMessage('styling', { role: 'user', content: 'x' })
    const s = await renderScreen(<Settings />)
    expect(s.text()).toContain('1 message saved on this device')
    await s.press('Clear AI Chat History')
    await pressAlertButton(alert, 'Clear')
    expect(useAIChatStore.getState().history.styling).toEqual([])
  })

  it('deletes the account only after typing DELETE', async () => {
    useCartStore.getState().addItem({ _id: 'p', price: 1, pointsEarned: 0 } as never)
    const { default: Settings } = await import('@/app/settings')
    const s = await renderScreen(<Settings />)
    await s.press('Delete Account')
    expect(s.button('Delete My Account').disabled).toBe(true)
    await s.type('DELETE', 'delete')
    await s.press('Delete My Account')
    expect(sent(api, 'DELETE /api/v1/me')).toEqual([{ confirm: 'DELETE' }])
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useCartStore.getState().items).toEqual([])
    expect(router.replace).toHaveBeenCalledWith('/(auth)')
    expect(alert).toHaveBeenLastCalledWith('Account deleted', expect.any(String))
  })

  it('keeps the account when deletion fails', async () => {
    routeApi(api, { 'DELETE /api/v1/me': new ApiError(500, 'Something went wrong. Please try again.') })
    const { default: Settings } = await import('@/app/settings')
    const s = await renderScreen(<Settings />)
    await s.press('Delete Account')
    await s.type('DELETE', 'DELETE')
    await s.press('Delete My Account')
    expect(alert).toHaveBeenLastCalledWith('Error', 'Something went wrong. Please try again.')
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })
})

describe('edit-profile', () => {
  it('saves name and phone, clearing an emptied phone', async () => {
    routeApi(api, { 'PATCH /api/v1/me': {} })
    const { default: EditProfile } = await import('@/app/edit-profile')
    const s = await renderScreen(<EditProfile />)
    expect(s.text()).toContain('ada@x.io')
    await s.type('John Doe', 'Ada N. Obi')
    await s.type('+234 800 000 0000', '')
    await s.press('Save Changes')
    expect(sent(api, 'PATCH /api/v1/me')).toEqual([{ fullName: 'Ada N. Obi', phone: null }])
    expect(useAuthStore.getState().customer).toMatchObject({ fullName: 'Ada N. Obi', phone: undefined })
    await pressAlertButton(alert, 'OK')
    expect(router.back).toHaveBeenCalled()
  })

  it('validates and reports server errors', async () => {
    routeApi(api, { 'PATCH /api/v1/me': new ApiError(400, 'Invalid request body') })
    const { default: EditProfile } = await import('@/app/edit-profile')
    const s = await renderScreen(<EditProfile />)
    await s.type('+234 800 000 0000', '123')
    await s.press('Save Changes')
    expect(s.text()).toContain('Enter a valid phone number')
    await s.type('+234 800 000 0000', '08099998888')
    await s.press('Save Changes')
    expect(alert).toHaveBeenLastCalledWith('Error', 'Invalid request body')
  })
})

describe('change-password', () => {
  function withUser(passwordEnabled: boolean, updatePassword = vi.fn(async () => ({}))) {
    useUser.mockReturnValue({ isLoaded: true, user: { passwordEnabled, updatePassword } as never })
    return updatePassword
  }

  it('changes the password with the current one, signing out other devices', async () => {
    const update = withUser(true)
    const { default: ChangePassword } = await import('@/app/change-password')
    const s = await renderScreen(<ChangePassword />)
    const [current, next, confirm] = s.inputs()
    await s.type(next, 'newpassword')
    await s.type(confirm, 'newpassword')
    await s.press('Update Password')
    expect(s.text()).toContain('Enter your current password')
    expect(update).not.toHaveBeenCalled()
    await s.type(current, 'oldpassword')
    await s.press('Update Password')
    expect(update).toHaveBeenCalledWith({ currentPassword: 'oldpassword', newPassword: 'newpassword', signOutOfOtherSessions: true })
    expect(alert).toHaveBeenLastCalledWith('Password Updated', expect.any(String), expect.any(Array))
  })

  it('shows Google-only accounts a set-password form without the current password', async () => {
    withUser(false)
    const { default: ChangePassword } = await import('@/app/change-password')
    const s = await renderScreen(<ChangePassword />)
    expect(s.text()).toContain('You sign in with Google.')
    expect(s.inputs()).toHaveLength(2)
    expect(s.hasButton('Set Password')).toBe(true)
  })

  it('lets Google-only accounts set a first password', async () => {
    const update = withUser(false)
    const { default: ChangePassword } = await import('@/app/change-password')
    const s = await renderScreen(<ChangePassword />)
    const [next, confirm] = s.inputs()
    await s.type(next, 'newpassword')
    await s.type(confirm, 'newpassword')
    await s.press('Set Password')
    expect(update).toHaveBeenCalledWith({ newPassword: 'newpassword', signOutOfOtherSessions: true })
  })

  it('shows Clerk errors', async () => {
    withUser(true, vi.fn(async () => { throw { errors: [{ message: 'Password is incorrect.' }] } }))
    const { default: ChangePassword } = await import('@/app/change-password')
    const s = await renderScreen(<ChangePassword />)
    for (const [i, v] of [[0, 'wrong'], [1, 'newpassword'], [2, 'newpassword']] as const) await s.type(s.inputs()[i], v)
    await s.press('Update Password')
    expect(alert).toHaveBeenLastCalledWith('Error', 'Password is incorrect.')
  })
})

describe('support', () => {
  it('opens contact links and expands FAQs', async () => {
    const { default: Support } = await import('@/app/support')
    const s = await renderScreen(<Support />)
    await s.press('Call Us')
    await s.press('WhatsApp')
    await s.press('Email Us')
    expect(vi.mocked(Linking.openURL).mock.calls.map((c) => c[0])).toEqual(['tel:+2348001234567', 'https://wa.me/2348001234567', 'mailto:support@cutty.app'])
    expect(s.text()).not.toContain('Unopened products')
    await s.press('What is your return policy on products?')
    expect(s.text()).toContain('Unopened products can be returned within 7 days')
    await s.press('What is your return policy on products?')
    expect(s.text()).not.toContain('Unopened products')
  })
})

describe('messages', () => {
  it('lists customer conversations with a way to find stylists', async () => {
    routeApi(api, { 'GET /api/v1/conversations': [] })
    const { default: Messages } = await import('@/app/messages')
    const s = await renderScreen(<Messages />)
    expect(s.text()).toContain('No chats yet')
    await s.press('Find a stylist')
    expect(router.push).toHaveBeenCalledWith('/stylists')
  })
})

describe('chat/[id]', () => {
  const msg = (id: string, over: object = {}) => ({ _id: id, conversationId: 'cv1', senderType: 'stylist', senderId: 's1', text: `text ${id}`, createdAt: '2026-06-01T10:00:00Z', ...over })
  const send = vi.fn()
  const typing = vi.fn()
  let incoming: (m: unknown) => void

  beforeEach(() => {
    setParams({ id: 'cv1', name: 'Ada' })
    vi.mocked(useConversation).mockImplementation((_id, onMessage) => {
      incoming = onMessage as never
      return { connected: true, otherTyping: false, send, typing }
    })
  })

  it('loads history (newest first) and shows incoming messages', async () => {
    routeApi(api, { 'GET /api/v1/conversations/cv1/messages': [msg('m2'), msg('m1', { senderType: 'customer', senderId: 'c1' })] })
    const { default: Chat } = await import('@/app/chat/[id]')
    const s = await renderScreen(<Chat />)
    expect(s.text()).toContain('Ada')
    expect(s.text()).toContain('Online chat')
    expect(s.text().indexOf('text m1')).toBeLessThan(s.text().indexOf('text m2'))
    await act(async () => incoming(msg('m3', { senderType: 'ai', text: 'Ada is away right now.' })))
    expect(s.text()).toContain('Cutty AI')
    expect(s.text()).toContain('Ada is away right now.')
    await act(async () => incoming(msg('m3', { senderType: 'ai', text: 'Ada is away right now.' })))
    expect(s.text().match(/Ada is away right now\./g)).toHaveLength(1)
  })

  it('sends optimistically, then swaps in the saved message', async () => {
    routeApi(api, { 'GET /api/v1/conversations/cv1/messages': [] })
    send.mockImplementation(async (text: string, clientId: string) => msg('saved', { senderType: 'customer', senderId: 'c1', text, clientId }))
    const { default: Chat } = await import('@/app/chat/[id]')
    const s = await renderScreen(<Chat />)
    expect(s.text()).toContain('Ask about a style, price or a time')
    await s.type('Type a message…', '  Are you free Saturday?  ')
    expect(typing).toHaveBeenCalled()
    await s.press(s.iconButton('send'))
    expect(send).toHaveBeenCalledWith('Are you free Saturday?', '00000000-0000-4000-8000-000000000000')
    expect(s.text()).toContain('Are you free Saturday?')
    expect(s.text()).not.toContain('Sending…')
  })

  it('marks failed sends and retries on tap', async () => {
    routeApi(api, { 'GET /api/v1/conversations/cv1/messages': [] })
    send.mockRejectedValueOnce(new Error('Not connected. Check your connection and try again.')).mockResolvedValueOnce(msg('ok', { senderType: 'customer', text: 'hi' }))
    const { default: Chat } = await import('@/app/chat/[id]')
    const s = await renderScreen(<Chat />)
    await s.type('Type a message…', 'hi')
    await s.press(s.iconButton('send'))
    expect(alert).toHaveBeenLastCalledWith('Not sent', 'Not connected. Check your connection and try again.')
    expect(s.text()).toContain('Not sent · tap to retry')
    await s.press('Not sent · tap to retry')
    expect(send).toHaveBeenCalledTimes(2)
    expect(s.text()).not.toContain('Not sent')
  })

  it('customers can ask Cutty AI inside the thread', async () => {
    routeApi(api, {
      'GET /api/v1/conversations/cv1/messages': [],
      'POST /api/v1/conversations/cv1/ask-ai': { question: msg('q', { senderType: 'customer', text: '@Cutty AI how long?' }), answer: msg('a', { senderType: 'ai', text: 'About 4 hours.' }) },
    })
    const { default: Chat } = await import('@/app/chat/[id]')
    const s = await renderScreen(<Chat />)
    await s.press(s.container.querySelector('[aria-label="Ask Cutty AI"]')!)
    await s.type('Ask Cutty AI about styles or care…', 'how long?')
    expect(typing).not.toHaveBeenCalled()
    await s.press(s.iconButton('send'))
    expect(sent(api, 'POST /api/v1/conversations/cv1/ask-ai')).toEqual([{ question: 'how long?' }])
    expect(s.text()).toContain('About 4 hours.')
    expect(send).not.toHaveBeenCalled()
  })

  it('restores the question when Cutty AI fails', async () => {
    routeApi(api, { 'GET /api/v1/conversations/cv1/messages': [], 'POST /api/v1/conversations/cv1/ask-ai': new ApiError(502, 'Cutty AI could not answer right now.') })
    const { default: Chat } = await import('@/app/chat/[id]')
    const s = await renderScreen(<Chat />)
    await s.press(s.container.querySelector('[aria-label="Ask Cutty AI"]')!)
    await s.type('Ask Cutty AI about styles or care…', 'help')
    await s.press(s.iconButton('send'))
    expect(alert).toHaveBeenLastCalledWith('Cutty AI', 'Cutty AI could not answer right now.')
    expect(s.input('Ask Cutty AI').value).toBe('help')
  })

  it('stylists use the Pro endpoints and can pick an AI-suggested reply', async () => {
    useAuthStore.setState({ role: 'stylist', stylist: { _id: 's1' } as never, customer: null })
    routeApi(api, {
      'GET /api/v1/pro/conversations/cv1/messages': [msg('m1', { senderType: 'customer', senderId: 'c1', text: 'price?' })],
      'POST /api/v1/pro/conversations/cv1/suggest': { suggestions: ['Knotless is ₦25,000.', 'Let me check.'] },
    })
    const { default: Chat } = await import('@/app/chat/[id]')
    const s = await renderScreen(<Chat />)
    expect(s.container.querySelector('[aria-label="Ask Cutty AI"]')).toBeNull()
    await s.press(s.container.querySelector('[aria-label="Suggest replies with AI"]')!)
    await s.press('Knotless is ₦25,000.')
    expect(s.input('Type a message…').value).toBe('Knotless is ₦25,000.')
  })

  it('reopens instantly from the cache, then merges the fresh copy', async () => {
    const { queryClient, keys } = await import('@/lib/data')
    queryClient.setQueryData(keys.messages('/api/v1/conversations/cv1'), [msg('cached', { text: 'from cache' })])
    let release!: (rows: unknown) => void
    vi.mocked(api).mockImplementation(() => new Promise((r) => { release = r }) as never)
    const { default: Chat } = await import('@/app/chat/[id]')
    const s = await renderScreen(<Chat />)
    // No spinner: the cached thread shows while the request is in flight.
    expect(s.text()).toContain('from cache')
    await act(async () => incoming(msg('live', { text: 'arrived on socket', createdAt: '2026-06-02T00:00:00Z' })))
    await act(async () => release([msg('fresh', { text: 'from server' }), msg('cached', { text: 'from cache' })]))
    expect(s.text()).toContain('from server')
    expect(s.text()).toContain('arrived on socket')
    expect(s.text().match(/from cache/g)).toHaveLength(1)
    expect(alert).not.toHaveBeenCalled()
  })

  it('keeps the cached thread without an alert when offline', async () => {
    const { queryClient, keys } = await import('@/lib/data')
    queryClient.setQueryData(keys.messages('/api/v1/conversations/cv1'), [msg('cached', { text: 'from cache' })])
    routeApi(api, { 'GET /api/v1/conversations/cv1/messages': new Error('Network request failed') })
    const { default: Chat } = await import('@/app/chat/[id]')
    const s = await renderScreen(<Chat />)
    expect(s.text()).toContain('from cache')
    expect(alert).not.toHaveBeenCalled()
  })

  it('pages older history when scrolled to the end', async () => {
    const page = Array.from({ length: 50 }, (_, i) => msg(`m${i}`, { createdAt: `2026-06-01T10:${String(59 - i).padStart(2, '0')}:00Z` }))
    routeApi(api, {
      'GET /api/v1/conversations/cv1/messages': page,
      'GET /api/v1/conversations/cv1/messages?before=*': [msg('old')],
    })
    const { default: Chat } = await import('@/app/chat/[id]')
    const s = await renderScreen(<Chat />)
    await act(async () => renderedLists.at(-1)!.onEndReached())
    expect(api).toHaveBeenCalledWith('GET', `/api/v1/conversations/cv1/messages?before=${encodeURIComponent('2026-06-01T10:10:00Z')}`)
    expect(s.text()).toContain('text old')
  })
})

describe('stylists (directory)', () => {
  const stylists = [
    { _id: 'a', name: 'Tunde', kind: 'barber', rating: 4.5, yearsExperience: 8, skills: ['Fades', 'Beards'], hasShop: true, styles: [], weeklyAvailability: [] },
    { _id: 'b', name: 'Ada', kind: 'braider', skills: ['Locs'], styles: [], weeklyAvailability: [] },
    { _id: 'c', name: 'Kemi', kind: 'both', skills: [], styles: [], weeklyAvailability: [] },
  ]

  it('filters by kind and search, and opens a profile', async () => {
    routeApi(api, { 'GET /api/v1/stylists': stylists })
    const { default: Stylists } = await import('@/app/stylists')
    const s = await renderScreen(<Stylists />)
    expect(s.text()).toContain('Barber · ★ 4.5 · 8 yrs · Shop')
    expect(s.text()).toContain('Braider · New')
    await s.press(/^Barbers$/)
    expect(s.text()).not.toContain('Ada')
    expect(s.text()).toContain('Kemi')
    await s.press(/^All$/)
    await s.type('Search by name or skill', 'LOCS')
    expect(s.text()).toContain('Ada')
    expect(s.text()).not.toContain('Tunde')
    await s.press('Ada')
    expect(router.push).toHaveBeenCalledWith('/stylist/b')
  })

  it('suggests AI search when nothing matches', async () => {
    routeApi(api, { 'GET /api/v1/stylists': [] })
    const { default: Stylists } = await import('@/app/stylists')
    const s = await renderScreen(<Stylists />)
    await s.press('Search with AI')
    expect(router.push).toHaveBeenCalledWith('/ai/search')
  })
})

describe('stylist/[id] (profile)', () => {
  const profile = {
    _id: 'st1', name: 'Ada Obi', kind: 'braider', rating: 4.86, totalReviews: 21, yearsExperience: 6, bio: 'Braids in Lekki.',
    hasShop: true, shopName: 'Ada Hair', barberId: 'b-ada', skills: ['Knotless'], styles: ['knotless-braids', 'Fulani braids'],
    weeklyAvailability: [{ day: 'saturday', start: '09:00', end: '17:00' }],
    bookingPrice: 2_500_000, bookingDuration: 240,
    products: [{ _id: 'p1', name: 'Edge gel', price: 300_000, slug: { current: 'edge-gel' } }],
  }

  beforeEach(() => setParams({ id: 'st1' }))

  it('shows the full profile', async () => {
    routeApi(api, { 'GET /api/v1/stylists/st1': profile })
    const { default: Profile } = await import('@/app/stylist/[id]')
    const s = await renderScreen(<Profile />)
    for (const t of ['Any style they offer240 min · pick your style when you book₦25,000', '★ 4.9 (21) · 6 years', 'Shop: Ada Hair', 'Braids in Lekki.', 'Knotless Braids', 'Also: Fulani braids', 'saturday09:00–17:00', 'mondayClosed', 'From Ada Hair', 'Edge gel']) {
      expect(s.text()).toContain(t)
    }
  })

  it('books, messages, tries on and shops', async () => {
    routeApi(api, { 'GET /api/v1/stylists/st1': profile, 'POST /api/v1/conversations': { _id: 'cv9' } })
    const { default: Profile } = await import('@/app/stylist/[id]')
    const s = await renderScreen(<Profile />)
    await s.press('Book Ada')
    expect(router.push).toHaveBeenCalledWith('/booking/new?stylistId=st1')
    await s.press(/^Message$/)
    expect(sent(api, 'POST /api/v1/conversations')).toEqual([{ stylistId: 'st1' }])
    expect(router.push).toHaveBeenCalledWith('/chat/cv9?name=Ada%20Obi')
    await s.press(s.container.querySelector('[aria-label="Try on Knotless Braids"]')!)
    expect(router.push).toHaveBeenCalledWith('/ai/tryon?styleId=knotless-braids')
    await s.press('Edge gel')
    expect(router.push).toHaveBeenCalledWith('/product/edge-gel')
  })

  it('hides booking until the stylist sets a price, and goes back if the stylist is gone', async () => {
    routeApi(api, { 'GET /api/v1/stylists/st1': { ...profile, bookingPrice: undefined, products: [], rating: undefined } })
    const { default: Profile } = await import('@/app/stylist/[id]')
    const s = await renderScreen(<Profile />)
    expect(s.text()).toContain('New on Cutty')
    expect(s.text()).toContain("Ada hasn't set a price yet. Message them to ask.")
    expect(s.hasButton('Book Ada')).toBe(false)

    setParams({ id: 'gone' })
    routeApi(api, { 'GET /api/v1/stylists/gone': new ApiError(404, 'Stylist not found') })
    await renderScreen(<Profile />)
    await pressAlertButton(alert, 'OK')
    expect(router.back).toHaveBeenCalled()
  })
})
