import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const SESSION_COOKIE = 'aerostat_session'

export { PERMISSION_LABELS } from './permissions'

export interface ManageUser {
  id: number
  username: string
  is_admin: boolean
  permissions: string[]
}

export class ManageApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function getSessionToken(): Promise<string | null> {
  const store = await cookies()
  const cookie = store.get(SESSION_COOKIE)
  if (!cookie) {
    return null
  }
  return cookie.value
}

export async function manageFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getSessionToken()
  const headers = new Headers(init.headers)
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }
  if (token) {
    headers.set('authorization', 'Bearer ' + token)
  }

  const res = await fetch(process.env.API_URL + '/api/manage' + path, {
    ...init,
    headers,
    cache: 'no-store',
  })

  if (!res.ok) {
    let message = 'Something went wrong'
    try {
      const body = await res.json()
      if (body.error) {
        message = body.error
      }
    } catch {
      message = 'Something went wrong (' + res.status + ')'
    }
    throw new ManageApiError(res.status, message)
  }

  const body = await res.text()
  if (!body) {
    return undefined as T
  }
  return JSON.parse(body) as T
}

export async function getCurrentUser(): Promise<ManageUser | null> {
  const token = await getSessionToken()
  if (!token) {
    return null
  }
  try {
    return await manageFetch<ManageUser>('/me')
  } catch (error) {
    if (error instanceof ManageApiError && error.status === 401) {
      return null
    }
    throw error
  }
}

export async function requireUser(): Promise<ManageUser> {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/manage/login')
  }
  return user
}

export function can(user: ManageUser, permission: string): boolean {
  if (user.is_admin) {
    return true
  }
  return user.permissions.includes(permission)
}

export function errorMessage(error: unknown): string {
  if (error instanceof ManageApiError) {
    return error.message
  }
  return 'Could not reach the server. Try again in a moment.'
}
