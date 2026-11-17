export interface ManageGroup {
  id: string
  name: string
  sort_order: number
}

export interface ManageService {
  id: string
  name: string
  check_type: string
  url: string
  group_id: string | null
  expected_status: number[]
  keyword: string | null
  keyword_absent: boolean
  dns_record_type: string | null
  dns_expected: string | null
  cert_warn_days: number | null
  cert_expires_at: string | null
  check_interval_seconds: number
  sort_order: number
}

export const CHECK_TYPES = [
  { value: 'http', label: 'HTTP(S) website or API' },
  { value: 'tcp', label: 'TCP port' },
  { value: 'dns', label: 'DNS record' },
]

export const DNS_RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT']

export function checkTypeLabel(value: string): string {
  let label = value
  for (const type of CHECK_TYPES) {
    if (type.value === value) {
      label = type.label
    }
  }
  return label
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
