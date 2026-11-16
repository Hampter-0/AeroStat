'use server'

import { revalidatePath } from 'next/cache'
import type { FormState } from '@/app/manage/actions'
import { errorMessage, manageFetch } from '@/lib/manage'

const KEYS = ['site_name', 'site_description', 'contact_url', 'public_url', 'primary_color', 'timezone', 'metrics_retention_days']
const ASSETS = ['logo', 'favicon']

function refreshEverything() {
  revalidatePath('/', 'layout')
}

export async function saveSettings(_state: FormState, formData: FormData): Promise<FormState> {
  const body: Record<string, string | null> = {}
  for (const key of KEYS) {
    if (formData.has(key)) {
      const value = String(formData.get(key) || '').trim()
      if (value === '') {
        body[key] = null
      } else {
        body[key] = value
      }
    }
  }

  try {
    await manageFetch('/settings', { method: 'PATCH', body: JSON.stringify(body) })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  refreshEverything()
  return { error: null, success: 'Saved' }
}

export async function resetSetting(_state: FormState, formData: FormData): Promise<FormState> {
  const key = String(formData.get('key') || '')
  if (!KEYS.includes(key)) {
    return { error: 'Unknown setting', success: null }
  }
  try {
    await manageFetch('/settings', { method: 'PATCH', body: JSON.stringify({ [key]: null }) })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  refreshEverything()
  return { error: null, success: 'Reset to default' }
}

export async function uploadAsset(_state: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get('name') || '')
  const file = formData.get('file')
  if (!ASSETS.includes(name)) {
    return { error: 'Unknown file', success: null }
  }
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose a file first', success: null }
  }

  let contentType = file.type
  if (!contentType && file.name.toLowerCase().endsWith('.ico')) {
    contentType = 'image/x-icon'
  }

  try {
    await manageFetch('/brand/' + name, {
      method: 'PUT',
      headers: { 'content-type': contentType },
      body: Buffer.from(await file.arrayBuffer()),
    })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  refreshEverything()
  return { error: null, success: 'Uploaded' }
}

export async function removeAsset(_state: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get('name') || '')
  if (!ASSETS.includes(name)) {
    return { error: 'Unknown file', success: null }
  }
  try {
    await manageFetch('/brand/' + name, { method: 'DELETE' })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  refreshEverything()
  return { error: null, success: 'Removed' }
}

export async function checkForUpdates(): Promise<FormState> {
  try {
    await manageFetch('/version/check', { method: 'POST' })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  revalidatePath('/manage', 'layout')
  return { error: null, success: null }
}

export async function saveNotifications(_state: FormState, formData: FormData): Promise<FormState> {
  const events: string[] = []
  for (const value of formData.getAll('events')) {
    events.push(String(value))
  }
  const body: { events: string[]; discord_webhook_url?: string } = {
    events: events,
  }
  const webhook = String(formData.get('discord_webhook_url') || '').trim()
  if (formData.get('remove_webhook') === 'on') {
    body.discord_webhook_url = ''
  } else if (webhook) {
    body.discord_webhook_url = webhook
  }

  try {
    await manageFetch('/notifications', { method: 'PUT', body: JSON.stringify(body) })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  revalidatePath('/manage/settings')
  return { error: null, success: 'Saved' }
}

export async function sendTestEmail(_state: FormState, formData: FormData): Promise<FormState> {
  const to = String(formData.get('to') || '').trim()
  try {
    await manageFetch('/email/test', { method: 'POST', body: JSON.stringify({ to: to }) })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  return { error: null, success: 'Sent to ' + to + '. It can take a minute to arrive.' }
}

export async function sendTestNotification(): Promise<FormState> {
  try {
    await manageFetch('/notifications/test', { method: 'POST' })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  return { error: null, success: 'Sent. Check your Discord channel.' }
}
