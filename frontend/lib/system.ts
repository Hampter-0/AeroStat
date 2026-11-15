export interface SystemInfo {
  overview: {
    version: string
    cpu: string | null
    cpu_cores: number
    memory_total_bytes: number | null
    memory_used_bytes: number | null
    process_memory_bytes: number | null
    kernel: string | null
    arch: string
    in_docker: boolean
    started_at: string
    postgres_version: string | null
    database_size_bytes: number | null
    redis_version: string | null
    redis_memory_bytes: number | null
  }
  counts: {
    users: number
    services: number
    groups: number
    incidents: number
    ongoing_incidents: number
    maintenance: number
    checks_stored: number
    activity_entries: number
  }
  health: {
    migrations_applied: number
    migrations_total: number
    database_ms: number | null
    redis_ms: number | null
    last_check_at: string | null
  }
  history: {
    version: string
    published_at: string | null
    installed_at: string | null
    url: string | null
  }[]
}

const UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB']

export function formatBytes(bytes: number | null): string {
  if (bytes === null) {
    return 'Unknown'
  }
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value = value / 1024
    unit = unit + 1
  }
  let digits = 2
  if (unit === 0) {
    digits = 0
  }
  return value.toFixed(digits) + ' ' + UNITS[unit]
}

export function formatCount(value: number): string {
  return value.toLocaleString('en-GB')
}

export function formatMs(ms: number | null): string {
  if (ms === null) {
    return 'No answer'
  }
  if (ms < 10) {
    return ms.toFixed(2) + ' ms'
  }
  return Math.round(ms) + ' ms'
}
