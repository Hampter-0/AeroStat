'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { FormState } from '@/app/manage/actions'
import { errorMessage, manageFetch } from '@/lib/manage'
import { flash } from '@/lib/flash'

function text(formData: FormData, key: string): string {
  return String(formData.get(key) || '')
}

export async function saveRole(_state: FormState, formData: FormData): Promise<FormState> {
  const id = text(formData, 'id')
  const permissions: string[] = []
  for (const value of formData.getAll('permissions')) {
    permissions.push(String(value))
  }
  const body = JSON.stringify({
    name: text(formData, 'name'),
    handle: text(formData, 'handle'),
    permissions: permissions,
  })

  let createdId = ''
  try {
    if (id) {
      await manageFetch('/roles/' + encodeURIComponent(id), { method: 'PATCH', body: body })
    } else {
      const created = await manageFetch<{ id: number }>('/roles', { method: 'POST', body: body })
      createdId = String(created.id)
    }
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  revalidatePath('/manage', 'layout')
  if (createdId) {
    await flash('Role created')
    redirect('/manage/roles/' + createdId)
  }
  return { error: null, success: 'Saved' }
}

export async function deleteRole(_state: FormState, formData: FormData): Promise<FormState> {
  const id = text(formData, 'id')
  try {
    await manageFetch('/roles/' + encodeURIComponent(id), { method: 'DELETE' })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  revalidatePath('/manage', 'layout')
  await flash('Role deleted')
  redirect('/manage/roles')
}
