import { createElement, type ReactNode } from 'react'
import { vi } from 'vitest'

// One shared, mutable Clerk instance; tests set `session` / `getToken` as needed.
export const clerk = {
  session: null as null | { getToken: () => Promise<string | null> },
  signOut: vi.fn(async () => {
    clerk.session = null
  }),
}

export const getClerkInstance = vi.fn(() => clerk)
const ok = async () => ({ error: null })
const signInResource = () => ({
  status: 'complete', supportedFirstFactors: [{ strategy: 'password' }], supportedSecondFactors: [],
  create: ok, password: ok, finalize: ok,
  mfa: { sendEmailCode: ok, verifyEmailCode: ok },
  resetPasswordEmailCode: { sendCode: ok, verifyCode: ok, submitPassword: ok },
})
const signUpResource = () => ({ status: 'complete', password: ok, finalize: ok, verifications: { sendEmailCode: ok, verifyEmailCode: ok } })

// Defaults succeed; tests override with mockReturnValue for specific flows.
export const useSignIn = vi.fn((): { signIn: any } => ({ signIn: signInResource() }))
export const useSignUp = vi.fn((): { signUp: any } => ({ signUp: signUpResource() }))
export const useSSO = vi.fn((): { startSSOFlow: any } => ({ startSSOFlow: async () => ({ createdSessionId: null, authSessionResult: { type: 'cancel' } }) }))
export const useAuth = vi.fn(() => ({ isLoaded: true, isSignedIn: false }))
export const useUser = vi.fn(() => ({ isLoaded: true, user: null }))
export const ClerkProvider = ({ children }: { children?: ReactNode }) => createElement('div', { 'data-clerk': true }, children)
