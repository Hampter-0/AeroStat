'use server'

import { revalidatePath } from 'next/cache'
import type { FormState } from '@/app/manage/actions'
import { errorMessage, manageFetch } from '@/lib/manage'

export async function resetTwoFactor(_state: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get('id') || '')
  try {
    await manageFetch('/users/' + encodeURIComponent(id) + '/reset-two-factor', { method: 'POST' })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  revalidatePath('/manage', 'layout')
  return { error: null, success: 'Two-factor reset' }
}
