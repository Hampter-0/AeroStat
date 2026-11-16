'use server'

import { flash } from '@/lib/flash'
import { errorMessage, manageFetch } from '@/lib/manage'
import type { StepResult } from '@/lib/two-factor'

export interface RestoreResult {
  restarting: boolean
  safety_backup: string
}

export async function restoreBackup(id: string, password: string): Promise<StepResult<RestoreResult>> {
  try {
    const data = await manageFetch<RestoreResult>('/backups/' + encodeURIComponent(id) + '/restore', {
      method: 'POST',
      body: JSON.stringify({ password: password }),
    })
    if (data.restarting) {
      await flash('Backup restored. Sign in again.')
    } else {
      await flash('Backup restored. Restart the backend now so newer migrations run, then sign in again.')
    }
    return { error: null, data: data }
  } catch (error) {
    return { error: errorMessage(error), data: null }
  }
}
