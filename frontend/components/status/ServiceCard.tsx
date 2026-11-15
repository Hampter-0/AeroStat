import type { DayHistory, ServiceStatus } from '@/lib/types'
import { Check, X } from '@/components/icons'
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
  let isDown = false
  if (service.status !== 'online') {
    checkClassName = 'live-check down'
    labelClassName = 'down'
    statusText = 'Down'
    isDown = true
  }

  let uptimeText = '-'
  if (uptimePercent !== null) {
    uptimeText = uptimePercent + '%'
  }

  return (
    <article className="live-service-card">
      <div className="live-service-heading">
        <div className="live-service-name">
          <span className={checkClassName}>
            {isDown && <X size={15} />}
            {!isDown && <Check size={15} />}
          </span>
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