'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { FormState } from '@/app/manage/actions'
import { getSiteConfig } from '@/lib/branding'
import { errorMessage, manageFetch } from '@/lib/manage'
import { inputValueToIso } from '@/lib/time'

interface Created {
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

async function windowBody(formData: FormData) {
  const { timezone } = await getSiteConfig()
  return {
    title: text(formData, 'title'),
    description: text(formData, 'description'),
    affected_services: selectedServices(formData),
    scheduled_start: inputValueToIso(text(formData, 'scheduled_start'), timezone),
    scheduled_end: inputValueToIso(text(formData, 'scheduled_end'), timezone),
    message: text(formData, 'message'),
  }
}

function missingTimes(formData: FormData): boolean {
  if (!text(formData, 'scheduled_start') || !text(formData, 'scheduled_end')) {
    return true
  }
  return false
}

function path(id: string, rest: string): string {
  return '/maintenance/' + encodeURIComponent(id) + rest
}

function refresh(id: string) {
  revalidatePath('/manage/maintenance')
  revalidatePath('/manage/maintenance/' + id)
}

export async function createMaintenance(_state: FormState, formData: FormData): Promise<FormState> {
  if (missingTimes(formData)) {
    return { error: 'Pick a start and end time', success: null }
  }
  let created: Created
  try {
    created = await manageFetch<Created>('/maintenance', {
      method: 'POST',
      body: JSON.stringify(await windowBody(formData)),
    })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  revalidatePath('/manage/maintenance')
  redirect('/manage/maintenance/' + created.id)
}

export async function updateMaintenance(_state: FormState, formData: FormData): Promise<FormState> {
  const id = text(formData, 'id')
  if (missingTimes(formData)) {
    return { error: 'Pick a start and end time', success: null }
  }
  try {
    await manageFetch(path(id, ''), { method: 'PATCH', body: JSON.stringify(await windowBody(formData)) })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  refresh(id)
  return { error: null, success: 'Details saved' }
}

export async function cancelMaintenance(_state: FormState, formData: FormData): Promise<FormState> {
  const id = text(formData, 'id')
  try {
    await manageFetch(path(id, '/cancel'), {
      method: 'POST',
      body: JSON.stringify({ message: text(formData, 'message') }),
    })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  refresh(id)
  return { error: null, success: null }
}

export async function reactivateMaintenance(_state: FormState, formData: FormData): Promise<FormState> {
  const id = text(formData, 'id')
  try {
    await manageFetch(path(id, '/reactivate'), { method: 'POST' })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  refresh(id)
  return { error: null, success: null }
}

export async function deleteMaintenance(_state: FormState, formData: FormData): Promise<FormState> {
  const id = text(formData, 'id')
  try {
    await manageFetch(path(id, ''), { method: 'DELETE' })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  revalidatePath('/manage/maintenance')
  redirect('/manage/maintenance')
}

export async function postMaintenanceUpdate(_state: FormState, formData: FormData): Promise<FormState> {
  const id = text(formData, 'id')
  try {
    await manageFetch(path(id, '/updates'), {
      method: 'POST',
      body: JSON.stringify({ status: text(formData, 'status'), message: text(formData, 'message') }),
    })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  refresh(id)
  return { error: null, success: 'Update posted' }
}

export async function editMaintenanceUpdate(_state: FormState, formData: FormData): Promise<FormState> {
  const id = text(formData, 'id')
  try {
    await manageFetch(path(id, '/updates/' + encodeURIComponent(text(formData, 'update_id'))), {
      method: 'PATCH',
      body: JSON.stringify({ status: text(formData, 'status'), message: text(formData, 'message') }),
    })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  refresh(id)
  return { error: null, success: 'Saved' }
}

export async function deleteMaintenanceUpdate(_state: FormState, formData: FormData): Promise<FormState> {
  const id = text(formData, 'id')
  try {
    await manageFetch(path(id, '/updates/' + encodeURIComponent(text(formData, 'update_id'))), {
      method: 'DELETE',
    })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  refresh(id)
  return { error: null, success: null }
}
