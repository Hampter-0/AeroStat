import type { DayHistory, ServiceStatus } from '@/lib/types'
import { Check, PendingRing, X } from '@/components/icons'
import UptimeBars from './UptimeBars'

export default function ServiceCard({
  service,
  uptimePercent,
  days,
  dayNote,
}: {
  service: ServiceStatus
  uptimePercent: number | null
  days: DayHistory[]
  dayNote: string
}) {
  let checkClassName = 'live-check'
  let labelClassName = ''
  let statusText = 'Operational'
  let icon = <Check size={15} />
  if (service.status === 'offline') {
    checkClassName = 'live-check down'
    labelClassName = 'down'
    statusText = 'Down'
    icon = <X size={15} />
  } else if (service.status === null) {
    checkClassName = 'live-check pending'
    labelClassName = 'pending'
    statusText = 'Not checked yet'
    icon = <PendingRing />
  }

  let uptimeText = '-'
  if (uptimePercent !== null) {
    uptimeText = uptimePercent + '%'
  }

  return (
    <article className="live-service-card">
      <div className="live-service-heading">
        <div className="live-service-name">
          <span className={checkClassName}>{icon}</span>
          <div>
            <strong>{service.name}</strong>
            <span className={labelClassName}>{statusText}</span>
          </div>
        </div>
        <div className="live-uptime">
          <strong>{uptimeText}</strong>
          <span>Uptime</span>
        </div>
      </div>
      <UptimeBars days={days} dayNote={dayNote} />
    </article>
  )
}