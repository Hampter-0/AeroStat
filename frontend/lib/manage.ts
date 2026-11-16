import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { hasPermission } from './permissions'
import { clientIp } from '@/lib/client-ip'

export const SESSION_COOKIE = 'aerostat_session'

export interface ManageUser {
  id: number
  username: string
  email: string | null
  is_admin: boolean
  permissions: string[]
  roles: string[]
  super_roles: string[]
  extra_permissions: string[]
  avatar_version: number | null
  two_factor_setup_required: boolean
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

async function visitorHeaders(): Promise<Record<string, string>> {
  const result: Record<string, string> = {}
  try {
    const store = await headers()
    const ip = clientIp(store.get('x-forwarded-for'), store.get('x-aerostat-peer'))
    if (ip) {
      result['x-forwarded-for'] = ip
    }
    const agent = store.get('user-agent')
    if (agent) {
      result['user-agent'] = agent
    }
  } catch {
    return result
  }
  return result
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
  const visitor = await visitorHeaders()
  for (const name of Object.keys(visitor)) {
    if (!headers.has(name)) {
      headers.set(name, visitor[name])
    }
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

export async function requireUser(allowBeforeSetup: boolean = false): Promise<ManageUser> {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/manage/login')
  }
  if (user.two_factor_setup_required && !allowBeforeSetup) {
    redirect('/manage/profile')
  }
  return user
}

export function can(user: ManageUser, permission: string): boolean {
  return hasPermission(user, permission)
}

export function errorMessage(error: unknown): string {
  if (error instanceof ManageApiError) {
    return error.message
  }
  return 'Could not reach the server. Try again in a moment.'
}
