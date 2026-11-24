export interface NotificationSettings {
  discord_configured: boolean
  discord_hint: string | null
  public_url: string | null
  events: string[]
  available_events: string[]
}

export const EVENT_GROUPS: { title: string; events: { id: string; label: string; hint: string }[] }[] = [
  {
    title: 'Services',
    events: [
      { id: 'service_down', label: 'A service goes down', hint: 'After two failed checks in a row' },
      { id: 'service_up', label: 'A service is back up', hint: 'With how long it was down' },
      {
        id: 'service_certificate',
        label: 'A certificate runs out soon',
        hint: 'Days before an HTTPS certificate expires',
      },
      {
        id: 'service_slow',
        label: 'Response times rise',
        hint: 'Much slower than usual, and when they are back to normal',
      },
    ],
  },
  {
    title: 'Incidents',
    events: [
      { id: 'incident_created', label: 'New incident', hint: 'When an incident is posted' },
      { id: 'incident_updated', label: 'Incident update', hint: 'Every new update on an incident' },
      { id: 'incident_resolved', label: 'Incident resolved', hint: 'When an update marks it resolved' },
    ],
  },
  {
    title: 'Maintenance',
    events: [
      { id: 'maintenance_scheduled', label: 'Maintenance planned', hint: 'When maintenance is scheduled' },
      { id: 'maintenance_started', label: 'Maintenance starts', hint: 'At the planned start time' },
      { id: 'maintenance_completed', label: 'Maintenance ends', hint: 'At the planned end time' },
      { id: 'maintenance_cancelled', label: 'Maintenance cancelled', hint: 'When planned maintenance is cancelled' },
    ],
  },
  {
    title: 'Admin',
    events: [
      { id: 'admin_backup_failed', label: 'A backup failed', hint: 'Scheduled or before an update' },
      { id: 'admin_update_available', label: 'New version available', hint: 'Once per new AeroStat release' },
      { id: 'admin_account_locked', label: 'Sign-in blocked', hint: 'An account had too many wrong passwords' },
      { id: 'admin_users', label: 'Users added or deleted', hint: 'Changes made by someone else' },
      {
        id: 'admin_security',
        label: 'Security changes',
        hint: 'Admins, suspensions, two-factor resets and restored backups',
      },
    ],
  },
]
