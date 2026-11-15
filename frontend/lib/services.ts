export interface ManageGroup {
  id: string
  name: string
  sort_order: number
}

export interface ManageService {
  id: string
  name: string
  url: string
  group_id: string | null
  expected_status: number[]
  check_interval_seconds: number
  sort_order: number
}

export interface ManageServicesResponse {
  groups: ManageGroup[]
  services: ManageService[]
}

export const INTERVAL_UNITS = [
  { value: 'seconds', label: 'seconds', seconds: 1 },
  { value: 'minutes', label: 'minutes', seconds: 60 },
  { value: 'hours', label: 'hours', seconds: 3600 },
]

export function splitInterval(seconds: number): { amount: number; unit: string } {
  if (seconds % 3600 === 0) {
    return { amount: seconds / 3600, unit: 'hours' }
  }
  if (seconds % 60 === 0) {
    return { amount: seconds / 60, unit: 'minutes' }
  }
  return { amount: seconds, unit: 'seconds' }
}

export function intervalLabel(seconds: number): string {
  const parts = splitInterval(seconds)
  let unit = parts.unit
  if (parts.amount === 1) {
    unit = unit.slice(0, -1)
    return 'Every ' + unit
  }
  return 'Every ' + parts.amount + ' ' + unit
}
