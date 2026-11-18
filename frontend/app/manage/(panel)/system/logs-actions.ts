'use server'

import { logsQuery, type LogsResponse } from '@/lib/logs'
import { manageFetch } from '@/lib/manage'

export async function fetchLogs(level: string, q: string, after: number | null): Promise<LogsResponse | null> {
  let path = '/system/logs?' + logsQuery(level, q)
  if (after !== null) {
    path = path + '&after=' + after
  }
  try {
    return await manageFetch<LogsResponse>(path)
  } catch {
    return null
  }
}
