'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { FormState } from '@/app/manage/actions'
import { getSiteConfig } from '@/lib/branding'
import { errorMessage, manageFetch } from '@/lib/manage'
import { inputValueToIso } from '@/lib/time'
import { flash } from '@/lib/flash'

interface CreatedIncident {
  id: number
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) || '')
}

function selectedServices(formData: FormData): string[] {
  const services: string[] = []
  for (const value of formData.getAll('affected_services')) {
    services.push(String(value))
  }
  return services
}

async function timeField(formData: FormData, key: string): Promise<string | null> {
  const value = text(formData, key)
  if (!value) {
    return null
  }
  const { timezone } = await getSiteConfig()
  return inputValueToIso(value, timezone)
}

async function changedTime(formData: FormData, key: string): Promise<string | null> {
  if (text(formData, key) === text(formData, key + '_before')) {
    return null
  }
  return timeField(formData, key)
}

function refresh(id: string) {
  revalidatePath('/manage/incidents')
  revalidatePath('/manage/incidents/' + id)
}

export async function createIncident(_state: FormState, formData: FormData): Promise<FormState> {
  let created: CreatedIncident
  try {
    created = await manageFetch<CreatedIncident>('/incidents', {
      method: 'POST',
      body: JSON.stringify({
        title: text(formData, 'title'),
        description: text(formData, 'description'),
        severity: text(formData, 'severity'),
        affected_services: selectedServices(formData),
        status: text(formData, 'status'),
        message: text(formData, 'message'),
        started_at: await timeField(formData, 'started_at'),
        resolved_at: await timeField(formData, 'resolved_at'),
      }),
    })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  revalidatePath('/manage/incidents')
  await flash('Incident posted')
  redirect('/manage/incidents/' + created.id)
}

export async function updateIncident(_state: FormState, formData: FormData): Promise<FormState> {
  const id = text(formData, 'id')
  try {
    await manageFetch('/incidents/' + encodeURIComponent(id), {
      method: 'PATCH',
      body: JSON.stringify({
        title: text(formData, 'title'),
        description: text(formData, 'description'),
        severity: text(formData, 'severity'),
        affected_services: selectedServices(formData),
        started_at: await changedTime(formData, 'started_at'),
      }),
    })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  refresh(id)
  return { error: null, success: 'Details saved' }
}

export async function deleteIncident(_state: FormState, formData: FormData): Promise<FormState> {
  const id = text(formData, 'id')
  try {
    await manageFetch('/incidents/' + encodeURIComponent(id), { method: 'DELETE' })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  revalidatePath('/manage/incidents')
  await flash('Incident deleted')
  redirect('/manage/incidents')
}

export async function postUpdate(_state: FormState, formData: FormData): Promise<FormState> {
  const id = text(formData, 'id')
  try {
    await manageFetch('/incidents/' + encodeURIComponent(id) + '/updates', {
      method: 'POST',
      body: JSON.stringify({ status: text(formData, 'status'), message: text(formData, 'message') }),
    })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  refresh(id)
  return { error: null, success: 'Update posted' }
}

export async function editUpdate(_state: FormState, formData: FormData): Promise<FormState> {
  const id = text(formData, 'id')
  const updateId = text(formData, 'update_id')
  try {
    await manageFetch('/incidents/' + encodeURIComponent(id) + '/updates/' + encodeURIComponent(updateId), {
      method: 'PATCH',
      body: JSON.stringify({
        status: text(formData, 'status'),
        message: text(formData, 'message'),
        created_at: await changedTime(formData, 'created_at'),
      }),
    })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  refresh(id)
  return { error: null, success: 'Saved' }
}

export async function deleteUpdate(_state: FormState, formData: FormData): Promise<FormState> {
  const id = text(formData, 'id')
  const updateId = text(formData, 'update_id')
  try {
    await manageFetch('/incidents/' + encodeURIComponent(id) + '/updates/' + encodeURIComponent(updateId), {
      method: 'DELETE',
    })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  refresh(id)
  return { error: null, success: null }
}
