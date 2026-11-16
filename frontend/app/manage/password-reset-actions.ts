'use server'

import type { FormState } from '@/app/manage/actions'
import { errorMessage, manageFetch } from '@/lib/manage'

export async function requestPasswordReset(_state: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get('email') || '').trim()
  try {
    await manageFetch('/password-reset', { method: 'POST', body: JSON.stringify({ email: email }) })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  return {
    error: null,
    success: 'If an account uses ' + email + ', we sent it a link to choose a new password. It works for 30 minutes.',
  }
}

export async function confirmPasswordReset(_state: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get('token') || '')
  const password = String(formData.get('password') || '')
  const repeat = String(formData.get('repeat') || '')
  if (password !== repeat) {
    return { error: 'The passwords don’t match.', success: null }
  }
  try {
    await manageFetch('/password-reset/confirm', {
      method: 'POST',
      body: JSON.stringify({ token: token, password: password }),
    })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  return { error: null, success: 'Your password is changed. You were signed out on every device.' }
}
