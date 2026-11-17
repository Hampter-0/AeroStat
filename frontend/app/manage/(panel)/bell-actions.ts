'use server'

import type { BellPage, BellSummary } from '@/lib/bell'
import { manageFetch } from '@/lib/manage'

export async function bellCount(): Promise<BellSummary | null> {
  try {
    return await manageFetch<BellSummary>('/bell/count')
  } catch {
    return null
  }
}

export async function bellList(filter: string, before: number | null): Promise<BellPage | null> {
  let path = '/bell?filter=' + encodeURIComponent(filter)
  if (before !== null) {
    path = path + '&before=' + before
  }
  try {
    return await manageFetch<BellPage>(path)
  } catch {
    return null
  }
}

export async function bellRead(ids: number[] | null): Promise<BellSummary | null> {
  try {
    return await manageFetch<BellSummary>('/bell/read', {
      method: 'POST',
      body: JSON.stringify({ ids: ids }),
    })
  } catch {
    return null
  }
}

export async function bellClear(): Promise<BellSummary | null> {
  try {
    return await manageFetch<BellSummary>('/bell', { method: 'DELETE' })
  } catch {
    return null
  }
}

export async function bellRemove(id: number): Promise<boolean> {
  try {
    await manageFetch('/bell/' + id, { method: 'DELETE' })
    return true
  } catch {
    return false
  }
}

export async function bellMute(until: string | null): Promise<BellSummary | null> {
  try {
    return await manageFetch<BellSummary>('/bell/mute', {
      method: 'PUT',
      body: JSON.stringify({ until: until }),
    })
  } catch {
    return null
  }
}
