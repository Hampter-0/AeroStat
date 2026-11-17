'use server'

import { revalidatePath } from 'next/cache'
import { errorMessage, manageFetch } from '@/lib/manage'
import type { StepResult } from '@/lib/two-factor'

async function step<T>(path: string, body: unknown): Promise<StepResult<T>> {
  try {
    const data = await manageFetch<T>(path, { method: 'POST', body: JSON.stringify(body) })
    revalidatePath('/manage', 'layout')
    return { error: null, data: data }
  } catch (error) {
    return { error: errorMessage(error), data: null }
  }
}

export async function startApp(password: string) {
  return step<{ qr: string; secret: string }>('/profile/two-factor/app', { password: password })
}

export async function confirmApp(code: string) {
  return step<{ recovery_codes: string[] | null }>('/profile/two-factor/app/confirm', { code: code })
}

export async function disableApp(password: string, code: string) {
  return step<null>('/profile/two-factor/app/disable', { password: password, code: code })
}

export async function startEmail(password: string) {
  return step<null>('/profile/two-factor/email', { password: password })
}

export async function confirmEmail(code: string) {
  return step<{ recovery_codes: string[] | null }>('/profile/two-factor/email/confirm', { code: code })
}

export async function startDisableEmail(password: string) {
  return step<null>('/profile/two-factor/email/disable/code', { password: password })
}

export async function disableEmail(code: string) {
  return step<null>('/profile/two-factor/email/disable', { code: code })
}

export async function newRecoveryCodes(password: string) {
  return step<{ recovery_codes: string[] }>('/profile/two-factor/recovery', { password: password })
}
