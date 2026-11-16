'use server'

import { revalidatePath } from 'next/cache'
import type { FormState } from '@/app/manage/actions'
import { errorMessage, manageFetch } from '@/lib/manage'
import type { PasskeyStep } from '@/lib/passkeys'

export async function startPasskey(name: string, discoverable: boolean, password: string): Promise<PasskeyStep<unknown>> {
  try {
    const options = await manageFetch<unknown>('/profile/passkeys', {
      method: 'POST',
      body: JSON.stringify({ name: name, discoverable: discoverable, password: password }),
    })
    return { error: null, data: options }
  } catch (error) {
    return { error: errorMessage(error), data: null }
  }
}

export async function finishPasskey(credential: unknown): Promise<PasskeyStep<{ name: string }>> {
  try {
    const created = await manageFetch<{ name: string }>('/profile/passkeys/finish', {
      method: 'POST',
      body: JSON.stringify({ credential: credential }),
    })
    revalidatePath('/manage/profile')
    return { error: null, data: created }
  } catch (error) {
    return { error: errorMessage(error), data: null }
  }
}

export async function removePasskey(_state: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get('id') || '')
  try {
    await manageFetch('/profile/passkeys/' + encodeURIComponent(id), { method: 'DELETE' })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  revalidatePath('/manage/profile')
  return { error: null, success: 'Passkey removed' }
}

export async function setPasswordLogin(_state: FormState, formData: FormData): Promise<FormState> {
  const enabled = formData.get('enabled') === 'on'
  try {
    await manageFetch('/profile/password-login', {
      method: 'PUT',
      body: JSON.stringify({ enabled: enabled, password: String(formData.get('password') || '') }),
    })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  revalidatePath('/manage/profile')
  if (enabled) {
    return { error: null, success: 'Password sign-in is on' }
  }
  return { error: null, success: 'Password sign-in is off. Sign in with a passkey from now on.' }
}
