export interface ServiceStatus {
  id: string
  name: string
  url: string
  group_id: string | null
  group_name: string | null
  status: 'online' | 'offline' | null
  response_time_ms: number | null
  checked_at: string | null
}

export interface MaintenanceWindow {
  id: number
  title: string
  description: string | null
  status: string
  affected_services: string[] | null
  scheduled_start: string
  scheduled_end: string
  created_at: string
}

export interface UptimeStats {
  service_id: string
  uptime_percent: number
  avg_response_time_ms: number
  total_checks: number
  period_days: number
}

export interface Incident {
  id: number
  title: string
  description: string | null
  status: string
  severity: string
  affected_services: string[] | null
  created_at: string
  resolved_at: string | null
}