import { cookies } from 'next/headers'

export const FLASH_COOKIE = 'aerostat_toast'

export async function flash(message: string) {
  const store = await cookies()
  store.set(FLASH_COOKIE, message, { path: '/', maxAge: 30, sameSite: 'lax' })
}
