export interface ServiceStatus {
  id: string
  name: string
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
  days: DayHistory[]
}

export interface DayEvent {
  kind: 'incident' | 'maintenance'
  id: number
  title: string
}

export interface DayHistory {
  date: string
  status: 'online' | 'degraded' | 'offline' | 'no_data'
  downtime_minutes: number
  uptime_percent?: number | null
  avg_response_time_ms?: number | null
  events: DayEvent[]
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

export interface StatusUpdate {
  id: number
  status: string
  message: string
  created_at: string
}

export interface IncidentDetail extends Incident {
  updates: StatusUpdate[]
}

export interface MaintenanceDetail extends MaintenanceWindow {
  updates: StatusUpdate[]
}
