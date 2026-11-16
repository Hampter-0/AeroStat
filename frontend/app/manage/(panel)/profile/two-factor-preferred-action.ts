'use server'

import { revalidatePath } from 'next/cache'
import { errorMessage, manageFetch } from '@/lib/manage'
import type { StepResult } from '@/lib/two-factor'

export async function setPreferredMethod(method: string): Promise<StepResult<null>> {
  try {
    await manageFetch('/profile/two-factor/preferred', { method: 'PUT', body: JSON.stringify({ method: method }) })
  } catch (error) {
    return { error: errorMessage(error), data: null }
  }
  revalidatePath('/manage/profile')
  return { error: null, data: null }
}
