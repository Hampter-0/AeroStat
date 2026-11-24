import Link from 'next/link'
import { IncidentMarker } from '@/components/status/EventMarker'
import StateBadge from '@/components/StateBadge'
import { formatStatus } from '@/lib/format'
import { incidentTone } from '@/lib/incidents'
import type { Incident } from '@/lib/types'

export default function IncidentEntry({ incident, meta }: { incident: Incident; meta: string }) {
  return (
    <Link href={'/incidents/' + incident.id} className="event-preview-link">
      <div className="event-preview">
        <IncidentMarker status={incident.status} severity={incident.severity} />
        <span className="event-title-row">
          <strong>{incident.title}</strong>
          <StateBadge tone={incidentTone(incident.status, incident.severity)}>{formatStatus(incident.status)}</StateBadge>
        </span>
        {incident.description && <span className="event-description">{incident.description}</span>}
        <span className="event-meta">{meta}</span>
      </div>
    </Link>
  )
}
