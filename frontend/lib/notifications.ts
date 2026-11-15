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
]
