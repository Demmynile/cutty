import { getClerkInstance, useSignIn, useSignUp } from '@clerk/expo'
import { useSSO } from '@clerk/expo/experimental'

// Thin wrappers over Clerk's custom-flow hooks, shared by the customer and
// Cutty Pro auth screens. Every action throws on failure; show the error with
// clerkErrorMessage(). Once one of these resolves "complete", the Clerk
// session is active and the screen calls enterAsCustomer / enterAsStylist.

/** Signs out a Clerk session left over from an unfinished flow, so a new sign-in can start. */
async function resetStaleSession() {
  const clerk = getClerkInstance()
  if (clerk.session) await clerk.signOut()
}

function unwrap({ error }: { error: unknown }) {
  if (error) throw error
}

/** Email + password sign-in. New devices may need a one-time email code. */
export function useEmailSignIn() {
  const { signIn } = useSignIn()

  async function finishOrAskForCode(): Promise<'complete' | 'code'> {
    if (signIn.status === 'complete') {
      unwrap(await signIn.finalize())
      return 'complete'
    }
    // Clerk's device trust (new device) or email-code second factor.
    // Only email codes are supported here; asking Clerk for one when the
    // account's second factor is something else fails with "The verification
    // strategy is not valid for this account".
    const canUseEmailCode = signIn.supportedSecondFactors.some((f) => f.strategy === 'email_code')
    if ((signIn.status === 'needs_client_trust' || signIn.status === 'needs_second_factor') && canUseEmailCode) {
      unwrap(await signIn.mfa.sendEmailCode())
      return 'code'
    }
    throw new Error('This account needs a sign-in step the app doesn’t support yet. Contact Cutty support.')
  }

  return {
    async start(email: string, password: string) {
      await resetStaleSession()
      // Look the account up first: accounts created with Google (or imported
      // without a password) have no password factor, and submitting one makes
      // Clerk fail with "The verification strategy is not valid for this account".
      unwrap(await signIn.create({ identifier: email.trim() }))
      const factors = signIn.supportedFirstFactors.map((f) => f.strategy)
      if (!factors.includes('password')) {
        throw new Error(
          factors.some((s) => s.startsWith('oauth_'))
            ? 'This account signs in with Google. Tap “Continue with Google” instead.'
            : 'This account doesn’t have a password yet. Tap “Forgot password?” to set one.',
        )
      }
      unwrap(await signIn.password({ password }))
      return finishOrAskForCode()
    },
    async verify(code: string) {
      unwrap(await signIn.mfa.verifyEmailCode({ code: code.trim() }))
      if (signIn.status !== 'complete') throw new Error('That code didn’t work. Try again.')
      unwrap(await signIn.finalize())
    },
    async resend() {
      unwrap(await signIn.mfa.sendEmailCode())
    },
  }
}

/** Email + password sign-up, confirmed with a code sent to the email. */
export function useEmailSignUp() {
  const { signUp } = useSignUp()
  return {
    async start(email: string, password: string) {
      await resetStaleSession()
      unwrap(await signUp.password({ emailAddress: email.trim(), password }))
      unwrap(await signUp.verifications.sendEmailCode())
    },
    async verify(code: string) {
      unwrap(await signUp.verifications.verifyEmailCode({ code: code.trim() }))
      if (signUp.status !== 'complete') {
        throw new Error('We couldn’t finish creating your account. Please try again.')
      }
      unwrap(await signUp.finalize())
    },
    async resend() {
      unwrap(await signUp.verifications.sendEmailCode())
    },
  }
}

/** Forgot password: email code, then a new password. Signs the user in when done. */
export function usePasswordReset() {
  const { signIn } = useSignIn()
  return {
    async start(email: string) {
      await resetStaleSession()
      unwrap(await signIn.create({ identifier: email.trim() }))
      unwrap(await signIn.resetPasswordEmailCode.sendCode())
    },
    async verify(code: string) {
      unwrap(await signIn.resetPasswordEmailCode.verifyCode({ code: code.trim() }))
    },
    async resend() {
      unwrap(await signIn.resetPasswordEmailCode.sendCode())
    },
    async setPassword(password: string) {
      unwrap(await signIn.resetPasswordEmailCode.submitPassword({ password, signOutOfOtherSessions: true }))
      if (signIn.status !== 'complete') throw new Error('Password updated. Please sign in with your new password.')
      unwrap(await signIn.finalize())
    },
  }
}

const FIELD_LABELS: Record<string, string> = {
  phone_number: 'a phone number',
  username: 'a username',
  first_name: 'a first name',
  last_name: 'a last name',
  password: 'a password',
  legal_accepted: 'accepting the terms',
}

/** "Continue with Google" (sign-in and sign-up are the same flow). Returns false if cancelled. */
export function useGoogleSignIn() {
  const { startSSOFlow } = useSSO()
  return async function signInWithGoogle(): Promise<boolean> {
    await resetStaleSession()
    const { createdSessionId, authSessionResult, signUp } = await startSSOFlow({ strategy: 'oauth_google' })
    // Clerk may sign into an existing session instead of creating one: check the session, not just the id.
    if (createdSessionId || getClerkInstance().session) return true
    // Clerk hadn't finished loading, so the Google page never opened.
    if (!authSessionResult) throw new Error('Sign-in is still starting up. Please try again in a moment.')
    if (authSessionResult.type !== 'success') return false // closed or cancelled by the user
    // Google signed in, but Clerk needs details Google doesn't provide (Clerk Dashboard → User & authentication).
    const missing: string[] = (signUp as { missingFields?: string[] } | undefined)?.missingFields ?? []
    if (missing.length) {
      const needs = missing.map((f) => FIELD_LABELS[f] ?? f.replace(/_/g, ' ')).join(' and ')
      throw new Error(`Google sign-up needs ${needs}, which Google doesn’t provide. Please sign up with email instead, or contact Cutty support.`)
    }
    throw new Error('We couldn’t finish signing you in with Google. Please try again.')
  }
}
