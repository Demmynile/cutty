'use client'

import { useState, useTransition } from 'react'
import { login } from './actions'

export default function AdminLoginPage() {
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await login(undefined, form)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-3xl">✂</span>
          </div>
          <h1 className="text-white text-3xl font-bold">Cutty Admin</h1>
          <p className="text-gray-400 mt-2">Sign in to manage your barbershop & salon</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-900 rounded-2xl p-8 space-y-5">
          {[
            { name: 'email', label: 'Email', type: 'email', autoComplete: 'username', placeholder: 'you@cutty.app' },
            { name: 'password', label: 'Password', type: 'password', autoComplete: 'current-password', placeholder: '••••••••' },
            { name: 'code', label: 'Authenticator code', type: 'text', autoComplete: 'one-time-code', placeholder: '123456', inputMode: 'numeric' as const },
          ].map((f) => (
            <div key={f.name}>
              <label htmlFor={f.name} className="text-gray-300 text-sm block mb-2">{f.label}</label>
              <input
                id={f.name}
                name={f.name}
                type={f.type}
                required
                autoComplete={f.autoComplete}
                inputMode={f.inputMode}
                placeholder={f.placeholder}
                className="w-full bg-gray-800 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-primary-500 outline-none"
              />
            </div>
          ))}
          {error && <p className="text-red-400 text-sm" role="alert">{error}</p>}
          <button type="submit" disabled={pending} className="w-full bg-primary-500 text-white py-3 rounded-xl font-semibold hover:bg-primary-600 transition-colors disabled:opacity-50">
            {pending ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
