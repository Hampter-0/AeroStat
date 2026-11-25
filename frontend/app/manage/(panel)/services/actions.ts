'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { FormState } from '@/app/manage/actions'
import { errorMessage, manageFetch } from '@/lib/manage'
import { INTERVAL_UNITS, type CheckTest } from '@/lib/services'
import { flash } from '@/lib/flash'

function text(formData: FormData, key: string): string {
  return String(formData.get(key) || '')
}

function parseStatuses(value: string): number[] | null {
  const statuses: number[] = []
  for (const part of value.split(/[\s,]+/)) {
    if (part === '') {
      continue
    }
    const code = Number(part)
    if (!Number.isInteger(code)) {
      return null
    }
    statuses.push(code)
  }
  return statuses
}

function intervalSeconds(formData: FormData): number {
  const amount = Number(text(formData, 'interval_amount'))
  let multiplier = 1
  for (const unit of INTERVAL_UNITS) {
    if (unit.value === text(formData, 'interval_unit')) {
      multiplier = unit.seconds
    }
  }
  return Math.round(amount * multiplier)
}

function serviceBody(formData: FormData) {
  let groupId: string | null = text(formData, 'group_id')
  if (groupId === '') {
    groupId = null
  }
  let checkType = text(formData, 'check_type')
  if (checkType === '') {
    checkType = 'http'
  }
  let statuses: number[] | null = [200]
  if (checkType === 'http') {
    statuses = parseStatuses(text(formData, 'expected_status'))
  }
  let dockerHostId: number | null = null
  const dockerText = text(formData, 'docker_host_id')
  if (checkType === 'docker' && dockerText !== '') {
    dockerHostId = Number(dockerText)
  }
  let slowAbove: number | null = null
  const slowText = text(formData, 'slow_above_ms').trim()
  if (slowText !== '') {
    slowAbove = Math.round(Number(slowText))
  }
  let certDays: number | null = null
  const certText = text(formData, 'cert_warn_days').trim()
  if (certText !== '') {
    certDays = Math.round(Number(certText))
  }
  return {
    name: text(formData, 'name'),
    check_type: checkType,
    url: text(formData, 'url'),
    group_id: groupId,
    expected_status: statuses,
    keyword: text(formData, 'keyword'),
    keyword_absent: text(formData, 'keyword_mode') === 'absent',
    dns_record_type: text(formData, 'dns_record_type'),
    dns_expected: text(formData, 'dns_expected'),
    cert_warn_days: certDays,
    docker_host_id: dockerHostId,
    slow_above_ms: slowAbove,
    slow_alerts: formData.get('slow_alerts') === 'on',
    check_interval_seconds: intervalSeconds(formData),
  }
}

function refreshAll() {
  revalidatePath('/manage/services')
}

export async function createService(_state: FormState, formData: FormData): Promise<FormState> {
  const body = serviceBody(formData)
  if (!body.expected_status) {
    return { error: 'Status codes must be numbers, separated by commas', success: null }
  }
  try {
    await manageFetch('/services', { method: 'POST', body: JSON.stringify(body) })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  refreshAll()
  await flash('Service added')
  redirect('/manage/services')
}

export async function updateService(_state: FormState, formData: FormData): Promise<FormState> {
  const id = text(formData, 'id')
  const body = serviceBody(formData)
  if (!body.expected_status) {
    return { error: 'Status codes must be numbers, separated by commas', success: null }
  }
  try {
    await manageFetch('/services/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(body) })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  refreshAll()
  revalidatePath('/manage/services/' + id)
  return { error: null, success: 'Saved. It will be checked again within a few seconds.' }
}

export async function deleteService(_state: FormState, formData: FormData): Promise<FormState> {
  const id = text(formData, 'id')
  try {
    await manageFetch('/services/' + encodeURIComponent(id), { method: 'DELETE' })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  refreshAll()
  await flash('Service deleted')
  redirect('/manage/services')
}

export async function moveService(_state: FormState, formData: FormData): Promise<FormState> {
  try {
    await manageFetch('/services/' + encodeURIComponent(text(formData, 'id')) + '/move', {
      method: 'POST',
      body: JSON.stringify({ direction: text(formData, 'direction') }),
    })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  refreshAll()
  return { error: null, success: null }
}

export async function testService(id: string): Promise<{ result: CheckTest | null; error: string | null }> {
  try {
    const result = await manageFetch<CheckTest>('/services/' + encodeURIComponent(id) + '/test', { method: 'POST' })
    return { result: result, error: null }
  } catch (error) {
    return { result: null, error: errorMessage(error) }
  }
}

export async function checkAllNow(): Promise<FormState> {
  try {
    await manageFetch('/services/check-now', { method: 'POST' })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  return { error: null, success: 'All services will be checked within a few seconds' }
}

export async function createGroup(_state: FormState, formData: FormData): Promise<FormState> {
  try {
    await manageFetch('/groups', { method: 'POST', body: JSON.stringify({ name: text(formData, 'name') }) })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  refreshAll()
  return { error: null, success: 'Group added' }
}

export async function renameGroup(_state: FormState, formData: FormData): Promise<FormState> {
  try {
    await manageFetch('/groups/' + encodeURIComponent(text(formData, 'id')), {
      method: 'PATCH',
      body: JSON.stringify({ name: text(formData, 'name') }),
    })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  refreshAll()
  return { error: null, success: 'Saved' }
}

export async function deleteGroup(_state: FormState, formData: FormData): Promise<FormState> {
  try {
    await manageFetch('/groups/' + encodeURIComponent(text(formData, 'id')), { method: 'DELETE' })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  refreshAll()
  return { error: null, success: null }
}

export async function moveGroup(_state: FormState, formData: FormData): Promise<FormState> {
  try {
    await manageFetch('/groups/' + encodeURIComponent(text(formData, 'id')) + '/move', {
      method: 'POST',
      body: JSON.stringify({ direction: text(formData, 'direction') }),
    })
  } catch (error) {
    return { error: errorMessage(error), success: null }
  }
  refreshAll()
  return { error: null, success: null }
}
