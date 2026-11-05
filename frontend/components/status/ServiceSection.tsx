'use client'

import { useState } from 'react'
import type { ServiceStatus, UptimeStats } from '@/lib/types'
import { Check, Chevron } from '@/components/icons'
import ServiceCard from './ServiceCard'

export default function ServiceSection({
  groupName,
  services,
  uptimeByServiceId,
  defaultOpen,
}: {
  groupName: string
  services: ServiceStatus[]
  uptimeByServiceId: Map<string, number>
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
          <Check size={12} /> {statusText} <Chevron open={open} />
        </span>
      </button>
      {open && (
        <div className="live-section-services">
          {services.map(function (service) {
            var uptimePercent = null
            if (uptimeByServiceId.has(service.id)) {
              uptimePercent = uptimeByServiceId.get(service.id)!
            }

            return (
              <ServiceCard
                service={service}
                groupName={groupName}
                uptimePercent={uptimePercent}
                key={service.id}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}