'use client'

import { useState } from 'react'
import type { DayHistory, ServiceStatus, UptimeStats } from '@/lib/types'
import { Check, Chevron, X } from '@/components/icons'
import ServiceCard from './ServiceCard'

export default function ServiceSection({
  groupName,
  services,
  uptimeByServiceId,
  defaultOpen,
}: {
  groupName: string
  services: ServiceStatus[]
  uptimeByServiceId: Map<string, UptimeStats>
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  var allOnline = true
  for (const service of services) {
    if (service.status !== 'online') {
      allOnline = false
    }
  }

  var statusClassName = 'live-section-status'
  var statusText = 'Operational'
  if (!allOnline) {
    statusClassName = 'live-section-status down'
    statusText = 'Degraded'
  }

  function toggleOpen() {
    setOpen(!open)
  }

  var serviceCountLabel = services.length + ' services'
  if (services.length === 1) {
    serviceCountLabel = '1 service'
  }

  return (
    <section className="live-service-section">
      <button className="live-section-heading" onClick={toggleOpen} aria-expanded={open}>
        <span>
          <strong>{groupName}</strong>
          <small>{serviceCountLabel}</small>
        </span>
        <span className={statusClassName}>
          {!allOnline && <X size={12} />}
          {allOnline && <Check size={12} />} {statusText} <Chevron open={open} />
        </span>
      </button>
      {open && (
        <div className="live-section-services">
          {services.map(function (service) {
            var uptimePercent = null
            var days: DayHistory[] = []
            if (uptimeByServiceId.has(service.id)) {
              const uptime = uptimeByServiceId.get(service.id)!
              uptimePercent = uptime.uptime_percent
              days = uptime.days
            }

            return (
              <ServiceCard
                service={service}
                groupName={groupName}
                uptimePercent={uptimePercent}
                days={days}
                key={service.id}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}