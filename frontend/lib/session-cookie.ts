import { cookies, headers } from 'next/headers'
import { SESSION_COOKIE } from '@/lib/manage'

export async function setSessionCookie(token: string, expiresAt: string) {
  const headerStore = await headers()
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: headerStore.get('x-forwarded-proto') === 'https',
    path: '/',
    expires: new Date(expiresAt),
  })
}
