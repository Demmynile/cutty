import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clerk, useSignIn, useSignUp, useSSO } from '../stubs/clerk-expo'
import { useEmailSignIn, useEmailSignUp, useGoogleSignIn, usePasswordReset } from '@/lib/useClerkAuth'

// Clerk's custom-flow resources resolve { error } rather than throwing; this
// builds one whose methods succeed unless told otherwise.
const ok = () => vi.fn(async (..._args: unknown[]): Promise<{ error: unknown }> => ({ error: null }))

function makeSignIn(over: Record<string, unknown> = {}) {
  return {
    status: 'complete',
    supportedFirstFactors: [{ strategy: 'password' }],
    supportedSecondFactors: [] as Array<{ strategy: string }>,
    create: ok(),
    password: ok(),
    finalize: ok(),
    mfa: { sendEmailCode: ok(), verifyEmailCode: ok() },
    resetPasswordEmailCode: { sendCode: ok(), verifyCode: ok(), submitPassword: ok() },
    ...over,
  }
}

let signIn: ReturnType<typeof makeSignIn>

beforeEach(() => {
  clerk.session = null
  signIn = makeSignIn()
  useSignIn.mockReturnValue({ signIn })
})

describe('useEmailSignIn', () => {
  it('signs in with a password and finalizes', async () => {
    await expect(useEmailSignIn().start(' ada@x.io ', 'pw')).resolves.toBe('complete')
    expect(signIn.create).toHaveBeenCalledWith({ identifier: 'ada@x.io' })
    expect(signIn.password).toHaveBeenCalledWith({ password: 'pw' })
    expect(signIn.finalize).toHaveBeenCalled()
  })

  it('signs out a stale session before starting', async () => {
    clerk.session = { getToken: async () => 'old' }
    await useEmailSignIn().start('a@b.c', 'pw')
    expect(clerk.signOut).toHaveBeenCalled()
  })

  it('asks for an email code on a new device, then verifies it', async () => {
    signIn.status = 'needs_client_trust'
    signIn.supportedSecondFactors = [{ strategy: 'email_code' }]
    const flow = useEmailSignIn()
    await expect(flow.start('a@b.c', 'pw')).resolves.toBe('code')
    expect(signIn.mfa.sendEmailCode).toHaveBeenCalled()

    signIn.mfa.verifyEmailCode.mockImplementation(async () => { signIn.status = 'complete'; return { error: null } })
    await flow.verify(' 123456 ')
    expect(signIn.mfa.verifyEmailCode).toHaveBeenCalledWith({ code: '123456' })
    expect(signIn.finalize).toHaveBeenCalled()
    await flow.resend()
    expect(signIn.mfa.sendEmailCode).toHaveBeenCalledTimes(2)
  })

  it('rejects a code that does not complete sign-in', async () => {
    signIn.status = 'needs_second_factor'
    await expect(useEmailSignIn().verify('000000')).rejects.toThrow(/didn’t work/)
  })

  it('refuses second factors other than email codes', async () => {
    signIn.status = 'needs_second_factor'
    signIn.supportedSecondFactors = [{ strategy: 'totp' }]
    await expect(useEmailSignIn().start('a@b.c', 'pw')).rejects.toThrow(/doesn’t support/)
  })

  it('explains accounts without a password factor', async () => {
    signIn.supportedFirstFactors = [{ strategy: 'oauth_google' }]
    await expect(useEmailSignIn().start('a@b.c', 'pw')).rejects.toThrow(/Continue with Google/)
    signIn.supportedFirstFactors = [{ strategy: 'email_code' }]
    await expect(useEmailSignIn().start('a@b.c', 'pw')).rejects.toThrow(/Forgot password/)
    expect(signIn.password).not.toHaveBeenCalled()
  })

  it('throws Clerk errors returned by a step', async () => {
    const err = { errors: [{ message: 'Password is incorrect' }] }
    signIn.password.mockResolvedValueOnce({ error: err })
    await expect(useEmailSignIn().start('a@b.c', 'bad')).rejects.toBe(err)
  })
})

describe('useEmailSignUp', () => {
  function makeSignUp() {
    return { status: 'missing_requirements', password: ok(), finalize: ok(), verifications: { sendEmailCode: ok(), verifyEmailCode: ok() } }
  }

  it('creates the account, sends a code, and finalizes after verification', async () => {
    const signUp = makeSignUp()
    useSignUp.mockReturnValue({ signUp })
    const flow = useEmailSignUp()
    await flow.start(' new@x.io ', 'pw')
    expect(signUp.password).toHaveBeenCalledWith({ emailAddress: 'new@x.io', password: 'pw' })
    expect(signUp.verifications.sendEmailCode).toHaveBeenCalled()

    signUp.verifications.verifyEmailCode.mockImplementation(async () => { signUp.status = 'complete'; return { error: null } })
    await flow.verify('111111')
    expect(signUp.finalize).toHaveBeenCalled()
    await flow.resend()
    expect(signUp.verifications.sendEmailCode).toHaveBeenCalledTimes(2)
  })

  it('fails if verification leaves the sign-up incomplete', async () => {
    useSignUp.mockReturnValue({ signUp: makeSignUp() })
    await expect(useEmailSignUp().verify('111111')).rejects.toThrow(/couldn’t finish/)
  })
})

describe('usePasswordReset', () => {
  it('sends a code, verifies it and sets the new password, signing out other sessions', async () => {
    const flow = usePasswordReset()
    await flow.start(' a@b.c ')
    expect(signIn.create).toHaveBeenCalledWith({ identifier: 'a@b.c' })
    expect(signIn.resetPasswordEmailCode.sendCode).toHaveBeenCalled()
    await flow.verify(' 222222 ')
    expect(signIn.resetPasswordEmailCode.verifyCode).toHaveBeenCalledWith({ code: '222222' })
    await flow.resend()
    await flow.setPassword('new-pw')
    expect(signIn.resetPasswordEmailCode.submitPassword).toHaveBeenCalledWith({ password: 'new-pw', signOutOfOtherSessions: true })
    expect(signIn.finalize).toHaveBeenCalled()
  })

  it('asks the user to sign in again when the reset does not complete sign-in', async () => {
    signIn.status = 'needs_second_factor'
    await expect(usePasswordReset().setPassword('pw')).rejects.toThrow(/sign in with your new password/)
  })
})

describe('useGoogleSignIn', () => {
  it.each([
    [{ createdSessionId: 'sess', authSessionResult: { type: 'success' } }, true],
    [{ createdSessionId: null, authSessionResult: { type: 'cancel' } }, false],
    [{ createdSessionId: null, authSessionResult: { type: 'dismiss' } }, false],
  ])('%o → %s', async (res, expected) => {
    const startSSOFlow = vi.fn(async () => res)
    useSSO.mockReturnValue({ startSSOFlow })
    await expect(useGoogleSignIn()()).resolves.toBe(expected)
    expect(startSSOFlow).toHaveBeenCalledWith({ strategy: 'oauth_google' })
  })

  it('counts an existing session that Clerk switched to as signed in', async () => {
    useSSO.mockReturnValue({ startSSOFlow: async () => {
      clerk.session = { getToken: async () => 't' }
      return { createdSessionId: null, authSessionResult: { type: 'success' } }
    } })
    await expect(useGoogleSignIn()()).resolves.toBe(true)
  })

  it('explains when Clerk had not finished loading', async () => {
    useSSO.mockReturnValue({ startSSOFlow: async () => ({ createdSessionId: null, authSessionResult: null }) })
    await expect(useGoogleSignIn()()).rejects.toThrow(/still starting up/)
  })

  it('names the details Clerk requires that Google does not provide', async () => {
    useSSO.mockReturnValue({ startSSOFlow: async () => ({
      createdSessionId: null, authSessionResult: { type: 'success' }, signUp: { missingFields: ['phone_number', 'legal_accepted'] },
    }) })
    await expect(useGoogleSignIn()()).rejects.toThrow('Google sign-up needs a phone number and accepting the terms')
  })

  it('throws when Google succeeds but no session was created', async () => {
    useSSO.mockReturnValue({ startSSOFlow: async () => ({ createdSessionId: null, authSessionResult: { type: 'success' } }) })
    await expect(useGoogleSignIn()()).rejects.toThrow(/Google/)
  })
})
