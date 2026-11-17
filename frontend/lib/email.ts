export interface EmailInfo {
  configured: boolean
  host: string | null
  port: number | null
  encryption: string | null
  username: string | null
  password_set: boolean
  from_address: string | null
  from_name: string | null
  recipients: number
}

export interface MyNotifications {
  email: string | null
  email_configured: boolean
  events: string[]
  panel_events: string[]
  panel_enabled: boolean
  available_events: string[]
}

export const ENCRYPTION_LABELS: Record<string, string> = {
  tls: 'TLS',
  starttls: 'STARTTLS',
  none: 'None',
}
