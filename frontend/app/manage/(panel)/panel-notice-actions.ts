'use server'

import type { PanelNotice, PanelNoticeSummary } from '@/lib/panel-notices'
import { manageFetch } from '@/lib/manage'

export async function noticeCount(): Promise<PanelNoticeSummary | null> {
  try {
    return await manageFetch<PanelNoticeSummary>('/panel-notices/count')
  } catch {
    return null
  }
}

export async function unreadNotices(): Promise<PanelNotice[] | null> {
  try {
    return await manageFetch<PanelNotice[]>('/panel-notices')
  } catch {
    return null
  }
}

export async function markNoticesRead(ids: number[]): Promise<PanelNoticeSummary | null> {
  try {
    return await manageFetch<PanelNoticeSummary>('/panel-notices/read', {
      method: 'POST',
      body: JSON.stringify({ ids: ids }),
    })
  } catch {
    return null
  }
}
