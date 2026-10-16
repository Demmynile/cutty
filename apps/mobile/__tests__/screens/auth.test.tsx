// @vitest-environment jsdom
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { router, setParams, setSegments } from '../stubs/expo-router'
import { Alert, renderedLists } from '../stubs/react-native'
import { clerk, useAuth, useSignIn, useSignUp, useSSO } from '../stubs/clerk-expo'
import { hideAsync } from '../stubs/misc-expo'
import { store as secureStore } from '../stubs/expo-secure-store'
import * as expoLocation from '../stubs/expo-location'
import { renderScreen } from '../helpers/screen'

vi.mock('@/lib/realtime', () => ({ disconnectRealtime: vi.fn(), useMessageListener: vi.fn(), useRealtimeWarmup: vi.fn() }))
vi.mock('@/lib/currency', async (orig) => ({ ...(await orig<typeof import('@/lib/currency')>()), loadExchangeRates: vi.fn() }))
vi.mock('@/lib/session', async (orig) => ({
  ...(await orig<typeof import('@/lib/session')>()),
  enterAsCustomer: vi.fn(),
  enterAsStylist: vi.fn(),
  createStylistProfile: vi.fn(),
  refreshAccount: vi.fn(),
}))

const { enterAsCustomer, enterAsStylist, createStylistProfile, refreshAccount } = await import('@/lib/session')
const { ApiError } = await import('@/lib/api')
const { useAuthStore } = await import('@/store/authStore')
const { useOnboardingStore } = await import('@/store/onboardingStore')

const ok = () => vi.fn(async () => ({ error: null }))

beforeEach(() => {
  document.body.innerHTML = ''
  secureStore.clear()
  clerk.session = null
  setParams({})
  setSegments([])
  useAuthStore.setState({ role: null, customer: null, stylist: null, isAuthenticated: false, isLoading: true, hydrated: true })
  useOnboardingStore.setState({ seen: true, hydrated: true, completedThisSession: true })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('app/_layout (root)', () => {
  async function loadLayout() {
    vi.stubEnv('EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_x')
    return (await import('@/app/_layout')).default
  }

  it('signed out: clears stale auth data, shows the app and hides the splash', async () => {
    const RootLayout = await loadLayout()
    secureStore.set('cutty_auth_role', 'stylist')
    useAuth.mockReturnValue({ isLoaded: true, isSignedIn: false })
    const s = await renderScreen(<RootLayout />)
    expect(secureStore.size).toBe(0)
    expect(useAuthStore.getState()).toMatchObject({ isAuthenticated: false, isLoading: false })
    expect(hideAsync).toHaveBeenCalled()
    expect([...s.container.querySelectorAll('[data-screen]')].map((e) => e.getAttribute('data-screen'))).toContain('(pro)')
  })

  it('signed in: refreshes the account in the background', async () => {
    const RootLayout = await loadLayout()
    useAuth.mockReturnValue({ isLoaded: true, isSignedIn: true })
    useAuthStore.setState({ isAuthenticated: true, role: 'customer', customer: { _id: 'c1' } as never })
    await renderScreen(<RootLayout />)
    expect(refreshAccount).toHaveBeenCalled()
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })

  it('signs out when the Cutty account is gone', async () => {
    const RootLayout = await loadLayout()
    clerk.session = { getToken: async () => 't' }
    useAuth.mockReturnValue({ isLoaded: true, isSignedIn: true })
    useAuthStore.setState({ isAuthenticated: true, customer: { _id: 'c1' } as never })
    vi.mocked(refreshAccount).mockRejectedValue(new ApiError(404, 'gone'))
    await renderScreen(<RootLayout />)
    expect(clerk.signOut).toHaveBeenCalled()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('redirects to the onboarding slideshow until it is dismissed this session', async () => {
    const RootLayout = await loadLayout()
    useAuth.mockReturnValue({ isLoaded: true, isSignedIn: false })
    useOnboardingStore.setState({ completedThisSession: false })
    expect((await renderScreen(<RootLayout />)).redirect()).toBe('/onboarding')
    setSegments(['onboarding'])
    expect((await renderScreen(<RootLayout />)).redirect()).toBeNull()
  })
})

describe('app/(auth)/_layout', () => {
  const load = async () => (await import('@/app/(auth)/_layout')).default

  it('sends signed-in users home by role', async () => {
    const AuthLayout = await load()
    useAuthStore.setState({ isAuthenticated: true, isLoading: false, role: 'stylist' })
    expect((await renderScreen(<AuthLayout />)).redirect()).toBe('/(pro)')
  })

  it('plays onboarding first, otherwise shows the auth stack', async () => {
    const AuthLayout = await load()
    useOnboardingStore.setState({ completedThisSession: false })
    expect((await renderScreen(<AuthLayout />)).redirect()).toBe('/onboarding')
    useOnboardingStore.setState({ completedThisSession: true })
    const s = await renderScreen(<AuthLayout />)
    expect(s.redirect()).toBeNull()
    expect(s.container.querySelectorAll('[data-screen]')).toHaveLength(6)
  })
})

describe('app/(auth)/index (welcome)', () => {
  it('defaults to the customer side and routes to sign-up / sign-in', async () => {
    const { default: Welcome } = await import('@/app/(auth)/index')
    const s = await renderScreen(<Welcome />)
    expect(s.text()).toContain('Book appointments in seconds')
    await s.press('Create account')
    expect(router.push).toHaveBeenCalledWith('/(auth)/register')
    await s.press('Sign in as a customer')
    expect(router.push).toHaveBeenCalledWith('/(auth)/login')
  })

  it('switches to the stylist side', async () => {
    const { default: Welcome } = await import('@/app/(auth)/index')
    const s = await renderScreen(<Welcome />)
    await s.press("I'm a stylist")
    expect(s.text()).toContain('Open your own shop & get paid')
    await s.press('Join Cutty Pro')
    expect(router.push).toHaveBeenCalledWith('/(auth)/pro-register')
    await s.press('Sign in as a stylist')
    expect(router.push).toHaveBeenCalledWith('/(auth)/pro-login')
  })

  it('starts on the side this device last used', async () => {
    secureStore.set('cutty_auth_role', 'stylist')
    const { default: Welcome } = await import('@/app/(auth)/index')
    expect((await renderScreen(<Welcome />)).text()).toContain('Join Cutty Pro')
  })
})

describe('login screens', () => {
  it('customer and Pro login wrap SignInScreen with the right role', async () => {
    const { default: Login } = await import('@/app/(auth)/login')
    const { default: ProLogin } = await import('@/app/(auth)/pro-login')
    expect((await renderScreen(<Login />)).text()).toContain('Welcome back')
    expect((await renderScreen(<ProLogin />)).text()).toContain('Stylist sign in')
  })
})

describe('app/(auth)/register', () => {
  async function fill(s: Awaited<ReturnType<typeof renderScreen>>, over: Partial<Record<string, string>> = {}) {
    const v = { name: 'Ada Obi', email: 'ada@x.io', phone: '08012345678', pw: 'password1', confirm: 'password1', ...over }
    await s.type('John Doe', v.name)
    await s.type('you@example.com', v.email)
    await s.type('+234 800 000 0000', v.phone)
    const [pw, confirm] = s.inputs().filter((i) => i.placeholder === '••••••••')
    await s.type(pw, v.pw)
    await s.type(confirm, v.confirm)
    await s.press(s.button(/^Create Account$/))
  }

  it('validates, then emails a code and creates the customer with name and phone', async () => {
    const signUp = { status: 'complete', password: ok(), finalize: ok(), verifications: { sendEmailCode: ok(), verifyEmailCode: ok() } }
    useSignUp.mockReturnValue({ signUp })
    const { default: Register } = await import('@/app/(auth)/register')
    const s = await renderScreen(<Register />)

    await fill(s, { confirm: 'different' })
    expect(s.text()).toContain("Passwords don't match")
    expect(signUp.password).not.toHaveBeenCalled()

    await fill(s)
    expect(signUp.password).toHaveBeenCalledWith({ emailAddress: 'ada@x.io', password: 'password1' })
    expect(s.text()).toContain('Check your email')
    await s.type('123456', '123456')
    await s.press(s.button(/^Create Account$/))
    expect(enterAsCustomer).toHaveBeenCalledWith({ fullName: 'Ada Obi', phone: '08012345678' })
  })

  it('alerts when Clerk rejects the sign-up', async () => {
    useSignUp.mockReturnValue({ signUp: { password: vi.fn(async () => ({ error: { errors: [{ message: 'That email is taken' }] } })) } })
    const { default: Register } = await import('@/app/(auth)/register')
    const s = await renderScreen(<Register />)
    await fill(s)
    expect(Alert.alert).toHaveBeenCalledWith('Registration failed', 'That email is taken')
  })

  it('Google sign-up creates the customer', async () => {
    useSSO.mockReturnValue({ startSSOFlow: async () => ({ createdSessionId: 's' }) })
    const { default: Register } = await import('@/app/(auth)/register')
    const s = await renderScreen(<Register />)
    await s.press('Continue with Google')
    expect(enterAsCustomer).toHaveBeenCalledWith()
    await s.press('Sign in')
    expect(router.replace).toHaveBeenCalledWith('/(auth)/login')
  })
})

// What the geocoder returns for a Lekki address, and the location it becomes.
const LEKKI = { streetNumber: '12', street: 'Admiralty Way', district: 'Lekki Phase 1', city: 'Lagos', region: 'Lagos', postalCode: '106104' }
const lekki = (lat: number, lng: number) => ({ lat, lng, address: '12 Admiralty Way', area: 'Lekki Phase 1', city: 'Lagos', state: 'Lagos', postcode: '106104' })

type Screen = Awaited<ReturnType<typeof renderScreen>>
async function enterPostcode(s: Screen) {
  vi.mocked(expoLocation.geocodeAsync).mockResolvedValue([{ latitude: 6.43, longitude: 3.47 }] as never)
  vi.mocked(expoLocation.reverseGeocodeAsync).mockResolvedValue([LEKKI] as never)
  await s.press('Enter address')
  await s.type('e.g. 106104', '106104')
  await s.press(/^Find$/)
}

describe('app/(auth)/pro-register', () => {
  it('creates a full Pro account with the chosen kind and work location', async () => {
    const signUp = { status: 'complete', password: ok(), finalize: ok(), verifications: { sendEmailCode: ok(), verifyEmailCode: ok() } }
    useSignUp.mockReturnValue({ signUp })
    const { default: ProRegister } = await import('@/app/(auth)/pro-register')
    const s = await renderScreen(<ProRegister />)
    expect(s.text()).toContain('Join as a stylist')
    await s.press('Braider')
    await s.type('Amaka Obi', 'Amaka Obi')
    await s.type('+234 800 000 0000', '08012345678')
    await enterPostcode(s)
    expect(expoLocation.geocodeAsync).toHaveBeenCalledWith('106104')
    for (const [label, value] of [['Street address', '12 Admiralty Way'], ['Area', 'Lekki Phase 1'], ['City', 'Lagos'], ['State', 'Lagos']]) {
      expect((s.container.querySelector(`[aria-label="${label}"]`) as HTMLInputElement).value).toBe(value)
    }
    await s.type('you@example.com', 'amaka@x.io')
    const [pw, confirm] = s.inputs().filter((i) => i.placeholder === '••••••••')
    await s.type(pw, 'password1')
    await s.type(confirm, 'password1')
    await s.press(s.button(/^Create Pro Account$/))
    await s.type('123456', '123456')
    await s.press(s.button(/^Create Pro Account$/))
    expect(createStylistProfile).toHaveBeenCalledWith({ fullName: 'Amaka Obi', phone: '08012345678', kind: 'braider', location: lekki(6.43, 3.47) })
  })

  it('asks only for profile details when already signed in with Clerk', async () => {
    clerk.session = { getToken: async () => 't' }
    const { default: ProRegister } = await import('@/app/(auth)/pro-register')
    const s = await renderScreen(<ProRegister />)
    expect(s.text()).toContain('Set up your Pro profile')
    expect(() => s.input('you@example.com')).toThrow()
    await s.type('Amaka Obi', 'Amaka Obi')
    await s.type('+234 800 000 0000', '08012345678')
    await s.press('Finish setup')
    expect(createStylistProfile).not.toHaveBeenCalled() // no work location yet
    expect(s.text()).toContain('Add where you work: drop a pin or enter your postcode.')

    vi.mocked(expoLocation.requestForegroundPermissionsAsync).mockResolvedValue({ status: 'granted' } as never)
    vi.mocked(expoLocation.reverseGeocodeAsync).mockResolvedValue([LEKKI] as never)
    await s.press('Use current location')
    expect(s.text()).not.toContain('Add where you work')
    await s.press('Finish setup')
    expect(createStylistProfile).toHaveBeenCalledWith({ fullName: 'Amaka Obi', phone: '08012345678', kind: 'barber', location: lekki(6.45, 3.39) })

    await s.press('Use a different account')
    expect(clerk.signOut).toHaveBeenCalled()
    expect(s.text()).toContain('Join as a stylist')
  })

  it('alerts and falls back to profile-only when creating the profile fails', async () => {
    clerk.session = { getToken: async () => 't' }
    vi.mocked(createStylistProfile).mockRejectedValue(new ApiError(409, 'You already have a Cutty Pro account.'))
    const { default: ProRegister } = await import('@/app/(auth)/pro-register')
    const s = await renderScreen(<ProRegister />)
    await s.type('Amaka Obi', 'Amaka Obi')
    await s.type('+234 800 000 0000', '08012345678')
    await enterPostcode(s)
    await s.press('Finish setup')
    expect(Alert.alert).toHaveBeenCalledWith('Sign up failed', 'You already have a Cutty Pro account.')
  })

  it('Google: an existing Pro account just signs in; a new one needs name, phone and location first', async () => {
    useSSO.mockReturnValue({ startSSOFlow: async () => ({ createdSessionId: 's' }) })
    const { default: ProRegister } = await import('@/app/(auth)/pro-register')
    const s = await renderScreen(<ProRegister />)
    await s.press('Continue with Google')
    expect(enterAsStylist).not.toHaveBeenCalled() // name/phone not valid yet
    expect(s.text()).toContain('Required')

    await s.type('Amaka Obi', 'Amaka Obi')
    await s.type('+234 800 000 0000', '08012345678')
    await s.press('Continue with Google')
    expect(enterAsStylist).not.toHaveBeenCalled()
    expect(s.text()).toContain('Add where you work')

    await enterPostcode(s)
    vi.mocked(enterAsStylist).mockResolvedValueOnce('ok')
    await s.press('Continue with Google')
    expect(createStylistProfile).not.toHaveBeenCalled()

    vi.mocked(enterAsStylist).mockResolvedValueOnce('needsProfile')
    await s.press('Continue with Google')
    expect(createStylistProfile).toHaveBeenCalledWith({ fullName: 'Amaka Obi', phone: '08012345678', kind: 'barber', location: lekki(6.43, 3.47) })
  })
})

describe('app/(auth)/forgot-password', () => {
  function resetFlow(status = 'complete') {
    const signIn = { status, create: ok(), finalize: ok(), resetPasswordEmailCode: { sendCode: ok(), verifyCode: ok(), submitPassword: ok() } }
    useSignIn.mockReturnValue({ signIn })
    return signIn
  }

  async function toPasswordStep(s: Awaited<ReturnType<typeof renderScreen>>) {
    await s.type('you@example.com', 'ada@x.io')
    await s.press('Send code')
    await s.type('123456', '123456')
    await s.press('Continue')
  }

  it('validates the email before sending a code', async () => {
    const signIn = resetFlow()
    const { default: Forgot } = await import('@/app/(auth)/forgot-password')
    const s = await renderScreen(<Forgot />)
    await s.type('you@example.com', 'nope')
    await s.press('Send code')
    expect(s.text()).toContain('Invalid email address')
    expect(signIn.create).not.toHaveBeenCalled()
  })

  it('walks email → code → new password and signs the customer in', async () => {
    const signIn = resetFlow()
    const { default: Forgot } = await import('@/app/(auth)/forgot-password')
    const s = await renderScreen(<Forgot />)
    await toPasswordStep(s)
    expect(s.text()).toContain('Choose a new password')
    const [pw, confirm] = s.inputs()
    await s.type(pw, 'short')
    await s.press('Save password')
    expect(s.text()).toContain('at least 8 characters')
    await s.type(pw, 'newpassword')
    await s.type(confirm, 'mismatch1')
    await s.press('Save password')
    expect(s.text()).toContain("Passwords don't match")
    await s.type(confirm, 'newpassword')
    await s.press('Save password')
    expect(signIn.resetPasswordEmailCode.submitPassword).toHaveBeenCalledWith({ password: 'newpassword', signOutOfOtherSessions: true })
    expect(enterAsCustomer).toHaveBeenCalled()
  })

  it('signs a stylist back in, sending them to set up a profile if needed', async () => {
    resetFlow()
    setParams({ role: 'stylist' })
    vi.mocked(enterAsStylist).mockResolvedValue('needsProfile')
    const { default: Forgot } = await import('@/app/(auth)/forgot-password')
    const s = await renderScreen(<Forgot />)
    await toPasswordStep(s)
    const [pw, confirm] = s.inputs()
    await s.type(pw, 'newpassword')
    await s.type(confirm, 'newpassword')
    await s.press('Save password')
    expect(router.replace).toHaveBeenCalledWith('/(auth)/pro-register')
  })

  it('shows Clerk errors when the code cannot be sent', async () => {
    const signIn = resetFlow()
    signIn.create.mockResolvedValueOnce({ error: { errors: [{ message: "Couldn't find your account." }] } } as never)
    const { default: Forgot } = await import('@/app/(auth)/forgot-password')
    const s = await renderScreen(<Forgot />)
    await s.type('you@example.com', 'ghost@x.io')
    await s.press('Send code')
    expect(s.text()).toContain("Couldn't find your account.")
  })
})

describe('app/sso-callback', () => {
  it('redirects signed-in users home, otherwise returns after a timeout', async () => {
    const { default: SSOCallback } = await import('@/app/sso-callback')
    useAuthStore.setState({ isAuthenticated: true, role: 'customer' })
    expect((await renderScreen(<SSOCallback />)).redirect()).toBe('/(tabs)')

    vi.useFakeTimers()
    useAuthStore.setState({ isAuthenticated: false })
    await renderScreen(<SSOCallback />)
    await act(async () => vi.advanceTimersByTime(4000))
    expect(router.back).toHaveBeenCalled()
    vi.useRealTimers()
  })
})

describe('app/onboarding', () => {
  it('pages through the slides and finishes on the last one', async () => {
    const { default: Onboarding } = await import('@/app/onboarding')
    const s = await renderScreen(<Onboarding />)
    expect(s.text()).toContain('Your chair is waiting')
    expect(s.images()).toContain('assets/onboarding/01.jpg')

    const list = renderedLists.at(-1)!
    await act(async () => list.onMomentumScrollEnd({ nativeEvent: { contentOffset: { x: 390 * 6 } } }))
    expect(s.hasButton('Skip')).toBe(false)
    await s.press('Get Started')
    expect(useOnboardingStore.getState().completedThisSession).toBe(true)
    expect(router.replace).toHaveBeenCalledWith('/(auth)')
  })

  it('Skip goes straight home for a signed-in user', async () => {
    useOnboardingStore.setState({ seen: false, completedThisSession: false })
    useAuthStore.setState({ isAuthenticated: true })
    const { default: Onboarding } = await import('@/app/onboarding')
    const s = await renderScreen(<Onboarding />)
    await s.press('Skip')
    expect(useOnboardingStore.getState().seen).toBe(true)
    expect(router.replace).toHaveBeenCalledWith('/(tabs)')
  })
})
