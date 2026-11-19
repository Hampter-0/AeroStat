import Link from 'next/link'
import LastChecked from '@/components/status/LastChecked'
import ServiceSection from '@/components/status/ServiceSection'
import { AlertSmall, Arrow, Check, Clock, Server, Tool, X } from '@/components/icons'
import { getIncidents, getStatus, getAllMaintenance, getUptime } from '@/lib/api'
import { getDisplayTime } from '@/lib/visitor-time'
import { currentTimeMs, formatWindow, zoneAbbreviation } from '@/lib/time'
import type { Incident, MaintenanceWindow, ServiceStatus, UptimeStats } from '@/lib/types'
import { incidentTone } from '@/lib/incidents'

export default async function Home() {
  const { timezone, siteTimezone } = await getDisplayTime()
  let dayNote = ''
  if (timezone !== siteTimezone) {
    dayNote = ' (' + zoneAbbreviation(siteTimezone) + ')'
  }
  let services: ServiceStatus[] = []
  let maintenanceWindows: MaintenanceWindow[] = []
  let incidents: Incident[] = []
  let uptimeResults: UptimeStats[] = []
  let backendIsDown = false

  try {
    services = await getStatus()
    maintenanceWindows = await getAllMaintenance()
    incidents = await getIncidents()
    uptimeResults = await Promise.all(
      services.map(function (service) {
        return getUptime(service.id)
      })
    )
  } catch {
    backendIsDown = true
  }

  if (backendIsDown) {
    return (
      <section className="status-unavailable">
        <h2>Status temporarily unavailable</h2>
        <p>We can&apos;t check the current status of our services right now. Please check back in a moment.</p>
      </section>
    )
  }

  const uptimeByServiceId = new Map<string, UptimeStats>()
  let i = 0
  while (i < services.length) {
    uptimeByServiceId.set(services[i].id, uptimeResults[i])
    i = i + 1
  }

  const groups = new Map<string, ServiceStatus[]>()
  for (const service of services) {
    let groupName = service.group_name
    if (!groupName) {
      groupName = 'Other'
    }
    if (!groups.has(groupName)) {
      groups.set(groupName, [])
    }
    groups.get(groupName)!.push(service)
  }

  let allOnline = true
  let lastCheckedAt: string | null = null
  for (const service of services) {
    if (service.status === 'offline') {
      allOnline = false
    }
    if (service.checked_at && (lastCheckedAt === null || service.checked_at > lastCheckedAt)) {
      lastCheckedAt = service.checked_at
    }
  }

  const ongoingIncidents: Incident[] = []
  for (const incident of incidents) {
    if (incident.status !== 'resolved') {
      ongoingIncidents.push(incident)
    }
  }

  let heroCheckClassName = 'operational-check'
  let heroText = 'Operational'
  let heroIcon = <Check size={34} />
  if (ongoingIncidents.length > 0) {
    heroCheckClassName = 'operational-check degraded'
    heroText = 'Degraded'
    heroIcon = <AlertSmall size={34} />
  }
  if (!allOnline) {
    heroCheckClassName = 'operational-check down'
    heroText = 'Degraded'
    heroIcon = <X size={34} />
  }
  if (services.length === 0) {
    heroCheckClassName = 'operational-check empty'
    heroText = 'No services yet'
    heroIcon = <Server size={30} />
  }

  const ongoingMaintenanceWindows: MaintenanceWindow[] = []
  for (const maintenanceWindow of maintenanceWindows) {
    if (maintenanceWindow.status === 'in_progress') {
      ongoingMaintenanceWindows.push(maintenanceWindow)
    }
  }

  const explainedServiceIds = new Set<string>()
  for (const incident of ongoingIncidents) {
    for (const serviceId of incident.affected_services || []) {
      explainedServiceIds.add(serviceId)
    }
  }
  for (const maintenanceWindow of ongoingMaintenanceWindows) {
    for (const serviceId of maintenanceWindow.affected_services || []) {
      explainedServiceIds.add(serviceId)
    }
  }

  const unexplainedDownNames: string[] = []
  for (const service of services) {
    if (service.status === 'offline' && !explainedServiceIds.has(service.id)) {
      unexplainedDownNames.push(service.name)
    }
  }

  let downNoticeText = ''
  if (unexplainedDownNames.length === 1) {
    downNoticeText = unexplainedDownNames[0] + ' is not responding'
  } else if (unexplainedDownNames.length > 1) {
    downNoticeText = unexplainedDownNames.join(', ') + ' are not responding'
  }

  let upcomingMaintenanceWindow: MaintenanceWindow | null = null
  for (const maintenanceWindow of maintenanceWindows) {
    if (maintenanceWindow.status === 'scheduled') {
      const start = new Date(maintenanceWindow.scheduled_start)
      if (upcomingMaintenanceWindow === null) {
        upcomingMaintenanceWindow = maintenanceWindow
      } else {
        const currentBestStart = new Date(upcomingMaintenanceWindow.scheduled_start)
        if (start < currentBestStart) {
          upcomingMaintenanceWindow = maintenanceWindow
        }
      }
    }
  }

  const groupEntries = Array.from(groups.entries())

  return (
    <>
      <section className="operational-hero">
        <span className={heroCheckClassName}>
          {heroIcon}
        </span>
        <h1>{heroText}</h1>
        {lastCheckedAt && <LastChecked checkedAt={lastCheckedAt} renderedAt={currentTimeMs()} />}
        <Link href="/incidents">Incident history <Arrow /></Link>
      </section>

      {downNoticeText && (
        <section className="notice tone-red">
          <span className="notice-icon tone-icon">
            <AlertSmall />
          </span>
          <div className="notice-copy">
            <h2>Service disruption</h2>
            <p className="incident-text">{downNoticeText}</p>
          </div>
        </section>
      )}

      {ongoingIncidents.map(function (incident) {
        return (
          <section className={'notice tone-' + incidentTone(incident.status, incident.severity)} key={'incident-' + incident.id}>
            <span className="notice-icon tone-icon">
              <AlertSmall />
            </span>
            <div className="notice-copy">
              <h2>Ongoing incident</h2>
              <p className="incident-text">{incident.title}</p>
            </div>
            <a className="text-button" href={'/incidents/' + incident.id}>
              View details <Arrow />
            </a>
          </section>
        )
      })}

      {ongoingMaintenanceWindows.map(function (maintenanceWindow) {
        return (
          <section className="notice tone-blue" key={'ongoing-maintenance-' + maintenanceWindow.id}>
            <span className="notice-icon tone-icon">
              <Tool />
            </span>
            <div className="notice-copy">
              <h2>Maintenance in progress</h2>
              <p className="ongoing-text">{maintenanceWindow.title}</p>
            </div>
            <a className="text-button" href={'/maintenance/' + maintenanceWindow.id}>
              View details <Arrow />
            </a>
          </section>
        )
      })}

      {upcomingMaintenanceWindow && (
        <section className="notice tone-blue">
          <span className="notice-icon tone-icon">
            <Clock />
          </span>
          <div className="notice-copy">
            <h2>Scheduled maintenance</h2>
            <p className="scheduled-text">
              {upcomingMaintenanceWindow.title} - {formatWindow(upcomingMaintenanceWindow.scheduled_start, upcomingMaintenanceWindow.scheduled_end, timezone)}
            </p>
          </div>
          <a className="text-button" href={'/maintenance/' + upcomingMaintenanceWindow.id}>
            View details <Arrow />
          </a>
        </section>
      )}

      <section className="live-status">
        <h2>Live Status</h2>
        {services.length === 0 && (
          <p className="live-status-empty">Nothing is being monitored yet. Services show up here as soon as they are added.</p>
        )}
        <div className="live-service-list">
          {groupEntries.map(function (entry, index) {
            const groupName = entry[0]
            const groupServices = entry[1]
            let isFirst = false
            if (index === 0) {
              isFirst = true
            }

            return (
              <ServiceSection
                groupName={groupName}
                services={groupServices}
                uptimeByServiceId={uptimeByServiceId}
                defaultOpen={isFirst}
                dayNote={dayNote}
                key={groupName}
              />
            )
          })}
        </div>
      </section>
    </>
  )
}