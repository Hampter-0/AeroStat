'use client'

import { useState } from 'react'
import type { DayHistory, ServiceStatus, UptimeStats } from '@/lib/types'
import { Check, Chevron, Tool, X } from '@/components/icons'
import ServiceCard from './ServiceCard'

export default function ServiceSection({
  groupName,
  services,
  uptimeByServiceId,
  maintenanceServiceIds,
  defaultOpen,
  dayNote,
}: {
  groupName: string
  services: ServiceStatus[]
  uptimeByServiceId: Map<string, UptimeStats>
  maintenanceServiceIds: string[]
  defaultOpen: boolean
  dayNote: string
}) {
  const [open, setOpen] = useState(defaultOpen)

  let allOnline = true
  let inMaintenance = false
  for (const service of services) {
    if (service.status === 'offline') {
      if (maintenanceServiceIds.includes(service.id)) {
        inMaintenance = true
      } else {
        allOnline = false
      }
    }
  }

  let statusClassName = 'live-section-status'
  let statusText = 'Operational'
  let statusIcon = <Check size={12} />
  if (inMaintenance) {
    statusClassName = 'live-section-status maintenance'
    statusText = 'Maintenance'
    statusIcon = <Tool size={12} />
  }
  if (!allOnline) {
    statusClassName = 'live-section-status down'
    statusText = 'Degraded'
    statusIcon = <X size={12} />
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
          {statusIcon} {statusText} <Chevron open={open} />
        </span>
      </button>
      {open && (
        <div className="live-section-services">
          {services.map(function (service) {
            let uptimePercent = null
            let days: DayHistory[] = []
            if (uptimeByServiceId.has(service.id)) {
              const uptime = uptimeByServiceId.get(service.id)!
              if (uptime.total_checks > 0) {
                uptimePercent = uptime.uptime_percent
              }
              days = uptime.days
            }

            return (
              <ServiceCard
                service={service}
                uptimePercent={uptimePercent}
                inMaintenance={maintenanceServiceIds.includes(service.id)}
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