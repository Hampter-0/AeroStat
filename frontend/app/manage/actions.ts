'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SESSION_COOKIE, errorMessage, manageFetch } from '@/lib/manage'
import { setSessionCookie } from '@/lib/session-cookie'
import type { TwoFactorChallenge } from '@/lib/two-factor'

export interface FormState {
  error: string | null
  success: string | null
}

export interface LoginState extends FormState {
  twoFactor: TwoFactorChallenge | null
}

interface LoginReply {
  token?: string
  expires_at?: string
  two_factor?: TwoFactorChallenge
}

export async function login(_state: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get('username') || '')
  const password = String(formData.get('password') || '')

  let reply: LoginReply
  try {
    reply = await manageFetch<LoginReply>('/login', {
      method: 'POST',
      body: JSON.stringify({ username: username, password: password }),
    })
  } catch (error) {
    return { error: errorMessage(error), success: null, twoFactor: null }
  }

  if (reply.two_factor) {
    return { error: null, success: null, twoFactor: reply.two_factor }
  }
  if (!reply.token || !reply.expires_at) {
    return { error: 'Something went wrong. Try again.', success: null, twoFactor: null }
  }
  await setSessionCookie(reply.token, reply.expires_at)
  redirect('/manage')
}

export async function logout() {
  try {
    await manageFetch('/logout', { method: 'POST' })
  } catch {
    console.error('Logout request failed; clearing the session cookie anyway')
  }
  const store = await cookies()
  store.delete(SESSION_COOKIE)
  redirect('/manage/login')
}
