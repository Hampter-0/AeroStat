import type { DayHistory, ServiceStatus } from '@/lib/types'
import StatusGlyph, { type GlyphKind } from '@/components/StatusGlyph'
import UptimeBars from './UptimeBars'

export default function ServiceCard({
  service,
  uptimePercent,
  inMaintenance,
  days,
  dayNote,
}: {
  service: ServiceStatus
  uptimePercent: number | null
  inMaintenance: boolean
  days: DayHistory[]
  dayNote: string
}) {
  let checkClassName = 'live-check'
  let labelClassName = ''
  let statusText = 'Operational'
  let kind: GlyphKind = 'check'
  if (service.status === 'offline' && inMaintenance) {
    checkClassName = 'live-check maintenance'
    labelClassName = 'maintenance'
    statusText = 'Maintenance'
    kind = 'wrench'
  } else if (service.status === 'offline') {
    checkClassName = 'live-check down'
    labelClassName = 'down'
    statusText = 'Down'
    kind = 'x'
  } else if (service.status === null) {
    checkClassName = 'live-check pending'
    labelClassName = 'pending'
    statusText = 'Not checked yet'
    kind = 'pending'
  }

  let responseText = ''
  if (service.status === 'online' && typeof service.response_time_ms === 'number') {
    responseText = service.response_time_ms + ' ms'
  }

  let uptimeText = 'No data yet'
  if (uptimePercent !== null) {
    uptimeText = uptimePercent + '% uptime'
  }

  return (
    <article className="live-service-card">
      <div className="live-service-heading">
        <div className="live-service-name">
          <span className={checkClassName} title={statusText}>
            <StatusGlyph kind={kind} size={20} />
          </span>
          <strong>{service.name}</strong>
          <span className="sr-only">{statusText}</span>
          {responseText && <small className="live-response">{responseText}</small>}
        </div>
        <span className={'live-uptime ' + labelClassName}>{uptimeText}</span>
      </div>
      <UptimeBars days={days} dayNote={dayNote} />
    </article>
  )
}
