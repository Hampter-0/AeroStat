'use server'

import { revalidatePath } from 'next/cache'
import type { FormState } from '@/app/manage/actions'
import { errorMessage, manageFetch } from '@/lib/manage'

function text(formData: FormData, key: string): string {
  return String(formData.get(key) || '')
}

function refresh() {
  revalidatePath('/manage', 'layout')
}

export async function updateProfile(_state: FormState, formData: FormData): Promise<FormState> {
  let email: string | null = text(formData, 'email').trim()
  if (email === '') {
    email = null
  }
  try {
    await manageFetch('/profile', {
      method: 'PATCH',
      body: JSON.stringify({
        username: text(formData, 'username'),
        email: email,
        current_password: text(formData, 'current_password'),
      }),
    })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  refresh()
  return { error: null, success: 'Saved' }
}

export async function saveEmailNotifications(_state: FormState, formData: FormData): Promise<FormState> {
  const events: string[] = []
  for (const value of formData.getAll('events')) {
    events.push(String(value))
  }
  try {
    await manageFetch('/profile/notifications', { method: 'PUT', body: JSON.stringify({ events: events }) })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  revalidatePath('/manage/profile')
  return { error: null, success: 'Saved' }
}

export async function changePassword(_state: FormState, formData: FormData): Promise<FormState> {
  const newPassword = text(formData, 'new_password')
  if (newPassword !== text(formData, 'repeat_password')) {
    return { error: 'The new passwords do not match', success: null }
  }
  try {
    await manageFetch('/profile/password', {
      method: 'POST',
      body: JSON.stringify({ current_password: text(formData, 'current_password'), new_password: newPassword }),
    })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  return { error: null, success: 'Password changed. You were signed out everywhere else.' }
}

export async function uploadAvatar(_state: FormState, formData: FormData): Promise<FormState> {
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose an image first', success: null }
  }
  try {
    await manageFetch('/profile/avatar', {
      method: 'PUT',
      headers: { 'content-type': file.type },
      body: Buffer.from(await file.arrayBuffer()),
    })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  refresh()
  return { error: null, success: 'Photo updated' }
}

export async function removeAvatar(): Promise<FormState> {
  try {
    await manageFetch('/profile/avatar', { method: 'DELETE' })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  refresh()
  return { error: null, success: 'Photo removed' }
}

export async function endSession(_state: FormState, formData: FormData): Promise<FormState> {
  const id = text(formData, 'id')
  try {
    await manageFetch('/profile/sessions/' + encodeURIComponent(id), { method: 'DELETE' })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  revalidatePath('/manage/profile/sessions')
  return { error: null, success: null }
}

export async function endOtherSessions(): Promise<FormState> {
  let result: { count: number }
  try {
    result = await manageFetch<{ count: number }>('/profile/sessions/others', { method: 'DELETE' })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  revalidatePath('/manage/profile/sessions')
  let message = 'Logged out ' + result.count + ' other devices'
  if (result.count === 1) {
    message = 'Logged out 1 other device'
  }
  return { error: null, success: message }
}
