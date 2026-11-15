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

export { UPDATE_COMMAND } from './update-command'

export async function getVersionInfo(): Promise<VersionInfo | null> {
  try {
    return await manageFetch<VersionInfo>('/version')
  } catch {
    return null
  }
}
