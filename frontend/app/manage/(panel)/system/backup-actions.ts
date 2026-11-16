'use server'

import { revalidatePath } from 'next/cache'
import type { FormState } from '@/app/manage/actions'
import type { Backup } from '@/lib/backups'
import { errorMessage, manageFetch } from '@/lib/manage'
import { formatBytes } from '@/lib/system'

export async function createBackup(): Promise<FormState> {
  let backup: Backup
  try {
    backup = await manageFetch<Backup>('/backups', { method: 'POST' })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  revalidatePath('/manage/system')
  return { error: null, success: 'Backup made (' + formatBytes(backup.size_bytes) + ')' }
}

export async function deleteBackup(_state: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get('id') || '')
  try {
    await manageFetch('/backups/' + encodeURIComponent(id), { method: 'DELETE' })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  revalidatePath('/manage/system')
  return { error: null, success: 'Backup deleted' }
}
