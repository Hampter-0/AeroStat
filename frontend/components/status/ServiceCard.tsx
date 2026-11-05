import type { ServiceStatus } from '@/lib/types'
import { Check } from '@/components/icons'
import UptimeBars from './UptimeBars'

export default function ServiceCard({
  service,
  groupName,
  uptimePercent,
}: {
  service: ServiceStatus
  groupName: string
  uptimePercent: number | null
}) {
  var checkClassName = 'live-check'
  var labelClassName = ''
  var statusText = 'Operational'
  if (service.status !== 'online') {
    checkClassName = 'live-check down'
    labelClassName = 'down'
    statusText = 'Down'
  }

  var uptimeText = '-'
  if (uptimePercent !== null) {
    uptimeText = uptimePercent + '%'
  }

  return (
    <article className="live-service-card">
      <div className="live-service-heading">
        <div className="live-service-name">
          <span className={checkClassName}>
            <Check size={15} />
          </span>
          <div>
            <strong>{service.name}</strong>
            <span className={labelClassName}>{statusText} - {groupName}</span>
          </div>
        </div>
        <div className="live-uptime">
          <strong>{uptimeText}</strong>
          <span>Uptime</span>
        </div>
      </div>
      <UptimeBars />
    </article>
  )
}