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
  dayNote,
}: {
  groupName: string
  services: ServiceStatus[]
  uptimeByServiceId: Map<string, UptimeStats>
  defaultOpen: boolean
  dayNote: string
}) {
  const [open, setOpen] = useState(defaultOpen)

  let allOnline = true
  for (const service of services) {
    if (service.status !== 'online') {
      allOnline = false
    }
  }

  let statusClassName = 'live-section-status'
  let statusText = 'Operational'
  if (!allOnline) {
    statusClassName = 'live-section-status down'
    statusText = 'Degraded'
  }

  function toggleOpen() {
    setOpen(!open)
  }

  let serviceCountLabel = services.length + ' services'
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
            let uptimePercent = null
            let days: DayHistory[] = []
            if (uptimeByServiceId.has(service.id)) {
              const uptime = uptimeByServiceId.get(service.id)!
              uptimePercent = uptime.uptime_percent
              days = uptime.days
            }

            return (
              <ServiceCard
                service={service}
                uptimePercent={uptimePercent}
                days={days}
                dayNote={dayNote}
                key={service.id}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}