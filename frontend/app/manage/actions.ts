'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
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

  const headerStore = await headers()
  const loginHeaders = new Headers()
  const forwarded = headerStore.get('x-forwarded-for')
  if (forwarded) {
    let clientIp = forwarded.split(',')[0].trim()
    if (clientIp.startsWith('::ffff:')) {
      clientIp = clientIp.slice(7)
    }
    loginHeaders.set('x-forwarded-for', clientIp)
  }
  const userAgent = headerStore.get('user-agent')
  if (userAgent) {
    loginHeaders.set('user-agent', userAgent)
  }

  let session: LoginResponse
  try {
    session = await manageFetch<LoginResponse>('/login', {
      method: 'POST',
      headers: loginHeaders,
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

function selectedPermissions(formData: FormData): string[] {
  const permissions: string[] = []
  for (const value of formData.getAll('permissions')) {
    permissions.push(String(value))
  }
  return permissions
}

export async function createUser(_state: FormState, formData: FormData): Promise<FormState> {
  const username = String(formData.get('username') || '')
  try {
    await manageFetch('/users', {
      method: 'POST',
      body: JSON.stringify({
        username: username,
        password: String(formData.get('password') || ''),
        is_admin: formData.get('is_admin') === 'on',
        permissions: selectedPermissions(formData),
        email: String(formData.get('email') || '').trim(),
      }),
    })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  revalidatePath('/manage/users')
  return { error: null, success: 'User ' + username.trim().toLowerCase() + ' created' }
}

export async function updateUser(_state: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get('id') || '')
  const body: { is_admin: boolean; permissions: string[]; email: string; password?: string } = {
    is_admin: formData.get('is_admin') === 'on',
    permissions: selectedPermissions(formData),
    email: String(formData.get('email') || '').trim(),
  }
  const password = String(formData.get('password') || '')
  if (password) {
    body.password = password
  }

  try {
    await manageFetch('/users/' + encodeURIComponent(id), {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  revalidatePath('/manage/users')
  return { error: null, success: 'Saved' }
}

export async function deleteUser(_state: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get('id') || '')
  try {
    await manageFetch('/users/' + encodeURIComponent(id), { method: 'DELETE' })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  revalidatePath('/manage/users')
  return { error: null, success: null }
}
