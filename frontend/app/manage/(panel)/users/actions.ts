'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { FormState } from '@/app/manage/actions'
import { errorMessage, manageFetch } from '@/lib/manage'
import { flash } from '@/lib/flash'

function text(formData: FormData, key: string): string {
  return String(formData.get(key) || '')
}

function permissions(formData: FormData): string[] {
  const list: string[] = []
  for (const value of formData.getAll('permissions')) {
    list.push(String(value))
  }
  return list
}

function roleIds(formData: FormData): number[] {
  const ids: number[] = []
  for (const value of formData.getAll('role_ids')) {
    const id = Number(value)
    if (Number.isInteger(id)) {
      ids.push(id)
    }
  }
  return ids
}

export async function createUser(_state: FormState, formData: FormData): Promise<FormState> {
  try {
    await manageFetch('/users', {
      method: 'POST',
      body: JSON.stringify({
        username: text(formData, 'username'),
        password: text(formData, 'password'),
        email: text(formData, 'email').trim(),
        role_ids: roleIds(formData),
        super_user: formData.get('super_user') === 'on',
        permissions: permissions(formData),
        two_factor_required: formData.get('two_factor_required') === 'on',
      }),
    })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  revalidatePath('/manage/users')
  await flash('User created')
  redirect('/manage/users')
}

export async function updateUser(_state: FormState, formData: FormData): Promise<FormState> {
  const id = text(formData, 'id')
  const body: {
    email: string
    role_ids: number[]
    super_user: boolean
    permissions: string[]
    two_factor_required: boolean
    password?: string
  } = {
    email: text(formData, 'email').trim(),
    role_ids: roleIds(formData),
    super_user: formData.get('super_user') === 'on',
    permissions: permissions(formData),
    two_factor_required: formData.get('two_factor_required') === 'on',
  }
  const password = text(formData, 'password')
  if (password) {
    body.password = password
  }
  try {
    await manageFetch('/users/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(body) })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  revalidatePath('/manage', 'layout')
  return { error: null, success: 'Saved' }
}

export async function deleteUser(_state: FormState, formData: FormData): Promise<FormState> {
  const id = text(formData, 'id')
  try {
    await manageFetch('/users/' + encodeURIComponent(id), { method: 'DELETE' })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  revalidatePath('/manage/users')
  await flash('User deleted')
  redirect('/manage/users')
}
