'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { SESSION_COOKIE, errorMessage, manageFetch } from '@/lib/manage'

export interface FormState {
  error: string | null
  success: string | null
}

interface LoginResponse {
  token: string
  expires_at: string
}

async function isHttps(): Promise<boolean> {
  const headerStore = await headers()
  return headerStore.get('x-forwarded-proto') === 'https'
}

export async function login(_state: FormState, formData: FormData): Promise<FormState> {
  const username = String(formData.get('username') || '')
  const password = String(formData.get('password') || '')

  let session: LoginResponse
  try {
    session = await manageFetch<LoginResponse>('/login', {
      method: 'POST',
      body: JSON.stringify({ username: username, password: password }),
    })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }

  const store = await cookies()
  store.set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: await isHttps(),
    path: '/',
    expires: new Date(session.expires_at),
  })
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
