// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { router } from '../stubs/expo-router'
import { Alert } from '../stubs/react-native'
import { useSSO, useSignIn } from '../stubs/clerk-expo'
import { renderScreen } from '../helpers/screen'

vi.mock('@/lib/api', async (orig) => ({ ...(await orig<typeof import('@/lib/api')>()), api: vi.fn() }))
vi.mock('@/lib/realtime', () => ({ useMessageListener: vi.fn(), disconnectRealtime: vi.fn() }))
vi.mock('@/lib/session', async (orig) => ({ ...(await orig<typeof import('@/lib/session')>()), enterAsCustomer: vi.fn(), enterAsStylist: vi.fn() }))

const { api, ApiError } = await import('@/lib/api')
const { useMessageListener } = await import('@/lib/realtime')
const { enterAsCustomer, enterAsStylist } = await import('@/lib/session')
const ui = await import('@/components/ui')
const { StylistAvatar } = await import('@/components/StylistAvatar')
const { ConversationList } = await import('@/components/ConversationList')
const { AuthField, EmailCodeStep, GoogleButton, OrDivider } = await import('@/components/auth/AuthParts')
const { SignInScreen } = await import('@/components/auth/SignInScreen')

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('components/ui', () => {
  it('ScreenHeader shows title, subtitle and a back button', async () => {
    const s = await renderScreen(<ui.ScreenHeader title="Wallet" subtitle="Balance" right={<span>R</span>} />)
    expect(s.text()).toContain('Wallet')
    expect(s.text()).toContain('Balance')
    await s.press(s.iconButton('arrow-back'))
    expect(router.back).toHaveBeenCalled()
    const noBack = await renderScreen(<ui.ScreenHeader title="Home" back={false} />)
    expect(noBack.container.querySelector('[data-icon="arrow-back"]')).toBeNull()
  })

  it('PrimaryButton presses, and is disabled while loading or disabled', async () => {
    const onPress = vi.fn()
    const s = await renderScreen(<ui.PrimaryButton label="Pay" onPress={onPress} icon="card" />)
    await s.press('Pay')
    expect(onPress).toHaveBeenCalledTimes(1)
    const loading = await renderScreen(<ui.PrimaryButton label="Pay" onPress={onPress} loading />)
    expect(loading.container.querySelector('[role=progressbar]')).not.toBeNull()
    expect(loading.container.querySelector('button')!.disabled).toBe(true)
    const off = await renderScreen(<ui.PrimaryButton label="Pay" onPress={onPress} disabled />)
    await off.press(off.container.querySelector('button')!)
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('SecondaryButton, SectionTitle, EmptyState and Banner actions fire', async () => {
    const fns = { a: vi.fn(), b: vi.fn(), c: vi.fn(), d: vi.fn() }
    const s = await renderScreen(
      <>
        <ui.SecondaryButton label="Edit" onPress={fns.a} tone="danger" small icon="pencil" />
        <ui.SectionTitle title="Services" action={{ label: 'See all', onPress: fns.b }} />
        <ui.EmptyState icon="cut" title="Nothing yet" body="Add one" action={{ label: 'Add', onPress: fns.c }} />
        <ui.Banner tone="warning" title="Under review" body="Hang tight" action={{ label: 'Details', onPress: fns.d }} />
        <ui.Card><span>inside</span></ui.Card>
      </>,
    )
    await s.press('Edit')
    await s.press('See all →')
    await s.press(/^Add$/)
    await s.press('Details →')
    expect(Object.values(fns).every((f) => f.mock.calls.length === 1)).toBe(true)
    expect(s.text()).toContain('Nothing yet')
    expect(s.text()).toContain('Hang tight')
    expect(s.text()).toContain('inside')
  })

  it('Chip selects or removes', async () => {
    const onRemove = vi.fn()
    const s = await renderScreen(<ui.Chip label="Fades" onRemove={onRemove} />)
    expect(s.container.querySelector('[data-icon="close"]')).not.toBeNull()
    await s.press('Fades')
    expect(onRemove).toHaveBeenCalled()
    const plain = await renderScreen(<ui.Chip label="Static" />)
    expect(plain.container.querySelector('button')!.disabled).toBe(true)
  })

  it('StatusPill humanises statuses; Loading shows a spinner', async () => {
    const s = await renderScreen(<><ui.StatusPill status="in_progress" /><ui.StatusPill status="mystery" /><ui.Loading /></>)
    expect(s.text()).toBe('in progressmystery')
    expect(s.container.querySelector('[role=progressbar]')).not.toBeNull()
  })
})

describe('StylistAvatar', () => {
  it('shows the photo, or the first initial', async () => {
    const photo = { _type: 'image', asset: { _type: 'reference', _ref: 'image-abc-10x10-jpg' } } as never
    const s = await renderScreen(<StylistAvatar s={{ name: 'Ada', photo }} size={40} />)
    expect(s.images()).toEqual(['https://cdn.sanity.io/images/testproj/test/abc-10x10.jpg?w=80&h=80&q=75&fit=crop&auto=format'])
    expect((await renderScreen(<StylistAvatar s={{ name: 'Bola' }} />)).text()).toBe('B')
  })
})

describe('ConversationList', () => {
  const convo = (id: string, unread: number, preview?: string) => ({
    _id: id, unread, lastMessagePreview: preview, lastMessageAt: '2026-01-01T10:00:00Z',
    customer: { _id: 'c1', name: 'Customer Kemi' }, stylist: { _id: 's1', name: `Stylist ${id}` },
  })

  it('lists threads with the other person’s name and unread counts, opening a chat on press', async () => {
    vi.mocked(api).mockResolvedValue([convo('a', 2, 'See you'), convo('b', 0)])
    const s = await renderScreen(<ConversationList as="customer" empty={{ title: 'No chats', body: '' }} />)
    expect(api).toHaveBeenCalledWith('GET', '/api/v1/conversations')
    expect(s.text()).toContain('Stylist a')
    expect(s.text()).toContain('See you')
    expect(s.text()).toContain('No messages yet')
    await s.press('Stylist a')
    expect(router.push).toHaveBeenCalledWith('/chat/a?name=Stylist%20a')
    // History starts loading during the screen transition, and the badge clears.
    expect(api).toHaveBeenCalledWith('GET', '/api/v1/conversations/a/messages')
    expect(s.container.querySelector('[aria-label="Chat with Stylist a"]')).not.toBeNull()
  })

  it('stylists see customer names and use the Pro endpoint', async () => {
    vi.mocked(api).mockResolvedValue([convo('a', 0)])
    const s = await renderScreen(<ConversationList as="stylist" empty={{ title: 'No chats', body: '' }} />)
    expect(api).toHaveBeenCalledWith('GET', '/api/v1/pro/conversations')
    expect(s.text()).toContain('Customer Kemi')
  })

  it('moves a thread to the top on a new message and counts it as unread', async () => {
    vi.mocked(api).mockResolvedValue([convo('a', 0, 'old'), convo('b', 0, 'older')])
    const s = await renderScreen(<ConversationList as="customer" empty={{ title: 'x', body: '' }} />)
    const listener = vi.mocked(useMessageListener).mock.calls.at(-1)![0]
    const { act } = await import('react')
    await act(async () => listener({ _id: 'm', conversationId: 'b', senderType: 'stylist', text: 'new!', createdAt: '2026-01-02T00:00:00Z' }))
    expect(s.text().indexOf('Stylist b')).toBeLessThan(s.text().indexOf('Stylist a'))
    expect(s.text()).toContain('new!')
    expect(s.container.querySelector('[aria-label="Chat with Stylist b, 1 unread"]')).not.toBeNull()
  })

  it('shows the empty state (also when loading fails)', async () => {
    vi.mocked(api).mockRejectedValue(new Error('offline'))
    const s = await renderScreen(<ConversationList as="customer" empty={{ title: 'No conversations', body: 'Message a stylist' }} />)
    expect(s.text()).toContain('No conversations')
  })
})

describe('auth parts', () => {
  it('AuthField labels the input and shows errors', async () => {
    const s = await renderScreen(<AuthField label="Email" placeholder="you@x" error="Required" value="" onChangeText={() => {}} />)
    expect(s.container.querySelector('input[aria-label="Email"]')).not.toBeNull()
    expect(s.text()).toContain('Required')
    expect((await renderScreen(<OrDivider />)).text()).toBe('or')
  })

  it('GoogleButton signs in, honours `before`, and alerts on failure', async () => {
    const startSSOFlow = vi.fn(async () => ({ createdSessionId: 'sess' }))
    useSSO.mockReturnValue({ startSSOFlow })
    const onSignedIn = vi.fn(async () => {})
    const s = await renderScreen(<GoogleButton onSignedIn={onSignedIn} />)
    await s.press('Continue with Google')
    expect(onSignedIn).toHaveBeenCalled()

    const blocked = await renderScreen(<GoogleButton onSignedIn={onSignedIn} before={() => false} />)
    await blocked.press('Continue with Google')
    expect(startSSOFlow).toHaveBeenCalledTimes(1)

    startSSOFlow.mockRejectedValueOnce({ errors: [{ message: 'Popup closed' }] })
    await s.press('Continue with Google')
    expect(Alert.alert).toHaveBeenCalledWith('Google sign-in failed', 'Popup closed')
  })

  it('EmailCodeStep enables submit only for 6 digits, verifies, shows errors and resends', async () => {
    const onVerify = vi.fn(async () => { throw { errors: [{ message: 'Incorrect code' }] } })
    const onResend = vi.fn(async () => {})
    const onBack = vi.fn()
    const s = await renderScreen(<EmailCodeStep email="ada@x.io" onVerify={onVerify} onResend={onResend} onBack={onBack} submitLabel="Confirm" />)
    expect(s.text()).toContain('ada@x.io')
    expect(s.button('Confirm').disabled).toBe(true)
    await s.type('123456', '123456')
    expect(s.button('Confirm').disabled).toBe(false)
    await s.press('Confirm')
    expect(onVerify).toHaveBeenCalledWith('123456')
    expect(s.text()).toContain('Incorrect code')
    await s.press('Resend code')
    expect(Alert.alert).toHaveBeenCalledWith('Code sent', 'We sent a new code to ada@x.io.')
    onResend.mockRejectedValueOnce(new Error('rate limited'))
    await s.press('Resend code')
    expect(Alert.alert).toHaveBeenLastCalledWith('Could not resend', 'rate limited')
    await s.press('← Back')
    expect(onBack).toHaveBeenCalled()
  })
})

describe('SignInScreen', () => {
  const signIn = (over: object = {}) => ({
    status: 'complete', supportedFirstFactors: [{ strategy: 'password' }], supportedSecondFactors: [{ strategy: 'email_code' }],
    create: vi.fn(async () => ({})), password: vi.fn(async () => ({})), finalize: vi.fn(async () => ({})),
    mfa: { sendEmailCode: vi.fn(async () => ({})), verifyEmailCode: vi.fn(async () => ({})) },
    ...over,
  })

  async function fill(s: Awaited<ReturnType<typeof renderScreen>>, email = 'ada@x.io', password = 'secret') {
    await s.type('you@example.com', email)
    await s.type('••••••••', password)
    await s.press(/^Sign In$/)
  }

  it('validates the form before calling Clerk', async () => {
    const si = signIn()
    useSignIn.mockReturnValue({ signIn: si })
    const s = await renderScreen(<SignInScreen role="customer" />)
    await s.type('••••••••', 'x')
    await fill(s, 'not-an-email', '')
    expect(s.text()).toContain('Invalid email address')
    expect(s.text()).toContain('Enter your password')
    expect(si.create).not.toHaveBeenCalled()
  })

  it('signs a customer in and loads their account', async () => {
    useSignIn.mockReturnValue({ signIn: signIn() })
    const s = await renderScreen(<SignInScreen role="customer" />)
    expect(s.text()).toContain('Welcome back')
    await fill(s)
    expect(enterAsCustomer).toHaveBeenCalled()
  })

  it('sends a stylist without a profile to Pro registration', async () => {
    useSignIn.mockReturnValue({ signIn: signIn() })
    vi.mocked(enterAsStylist).mockResolvedValue('needsProfile')
    const s = await renderScreen(<SignInScreen role="stylist" />)
    expect(s.text()).toContain('CUTTY PRO')
    await fill(s)
    expect(router.replace).toHaveBeenCalledWith('/(auth)/pro-register')
  })

  it('switches to the email-code step on a new device', async () => {
    const si = signIn({ status: 'needs_client_trust' })
    useSignIn.mockReturnValue({ signIn: si })
    const s = await renderScreen(<SignInScreen role="customer" />)
    await fill(s)
    expect(s.text()).toContain('Check your email')
    si.mfa.verifyEmailCode.mockImplementation(async () => { si.status = 'complete'; return {} })
    await s.type('123456', '654321')
    await s.press(/^Sign In$/)
    expect(enterAsCustomer).toHaveBeenCalled()
  })

  it('explains server outages differently from bad credentials', async () => {
    useSignIn.mockReturnValue({ signIn: signIn() })
    vi.mocked(enterAsCustomer).mockRejectedValue(new ApiError(403, 'This account has been deactivated.'))
    const s = await renderScreen(<SignInScreen role="customer" />)
    await fill(s)
    expect(Alert.alert).toHaveBeenLastCalledWith('Sign in failed', 'This account has been deactivated.')

    useSignIn.mockReturnValue({ signIn: signIn({ password: vi.fn(async () => ({ error: { errors: [{ message: 'Password is incorrect' }] } })) }) })
    const bad = await renderScreen(<SignInScreen role="customer" />)
    await fill(bad)
    expect(Alert.alert).toHaveBeenLastCalledWith('Sign in failed', 'Password is incorrect')
  })

  it('links to forgot-password and sign-up', async () => {
    useSignIn.mockReturnValue({ signIn: signIn() })
    const s = await renderScreen(<SignInScreen role="stylist" />)
    await s.press('Forgot password?')
    expect(router.push).toHaveBeenCalledWith({ pathname: '/(auth)/forgot-password', params: { role: 'stylist' } })
    await s.press('Create a Pro account')
    expect(router.replace).toHaveBeenCalledWith('/(auth)/pro-register')
  })
})
