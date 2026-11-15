import { manageFetch } from './manage'

export interface VersionInfo {
  current: string
  latest: string | null
  update_available: boolean
  release_url: string | null
  update_check: boolean
  checked_at: string | null
  check_error: string | null
}

export const UPDATE_COMMAND = 'docker compose pull && docker compose up -d'

export async function getVersionInfo(): Promise<VersionInfo | null> {
  try {
    return await manageFetch<VersionInfo>('/version')
  } catch {
    return null
  }
}
