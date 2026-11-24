import Link from 'next/link'
import LastChecked from '@/components/status/LastChecked'
import Notice from '@/components/status/Notice'
import PastIncidents, { PAST_DAYS } from '@/components/status/PastIncidents'
import ResponseChart from '@/components/status/ResponseChart'
import ServiceSection from '@/components/status/ServiceSection'
import { AlertSmall, Arrow, Check, Server, Tool, X } from '@/components/icons'
import { getIncidents, getIncidentsBetween, getResponseTimes, getStatus, getAllMaintenance, getUptime } from '@/lib/api'
import { getDisplayTime } from '@/lib/visitor-time'
import { currentTimeMs, formatDateTimeShort, formatWindow, zoneAbbreviation } from '@/lib/time'
import { formatStatus } from '@/lib/format'
import type { Incident, MaintenanceWindow, ResponseTimes, ServiceStatus, UptimeStats } from '@/lib/types'
import { affectedLabels } from '@/lib/affected'
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
  let pastIncidents: Incident[] = []
  let responseTimes: ResponseTimes | null = null
  let backendIsDown = false
  const renderedAt = currentTimeMs()

  try {
    services = await getStatus()
    maintenanceWindows = await getAllMaintenance()
    incidents = await getIncidents()
    uptimeResults = await Promise.all(
      services.map(function (service) {
        return getUptime(service.id)
      })
    )
    const pastFrom = new Date(renderedAt - (PAST_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString()
    pastIncidents = await getIncidentsBetween(pastFrom, new Date(renderedAt + 60 * 1000).toISOString())
    responseTimes = await getResponseTimes('day', '')
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

  const maintenanceServiceIds: string[] = []
  for (const maintenanceWindow of maintenanceWindows) {
    if (maintenanceWindow.status === 'in_progress') {
      for (const serviceId of maintenanceWindow.affected_services || []) {
        maintenanceServiceIds.push(serviceId)
      }
    }
  }

  let allOnline = true
  let downInMaintenance = false
  let lastCheckedAt: string | null = null
  for (const service of services) {
    if (service.status === 'offline') {
      if (maintenanceServiceIds.includes(service.id)) {
        downInMaintenance = true
      } else {
        allOnline = false
      }
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
  if (downInMaintenance) {
    heroCheckClassName = 'operational-check maintenance'
    heroText = 'Maintenance'
    heroIcon = <Tool size={30} />
  }
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

  const slowServices = services.filter(function (service) {
    return typeof service.slow_ms === 'number' && service.status === 'online'
  })
  let slowNoticeText = ''
  if (slowServices.length === 1) {
    slowNoticeText = slowServices[0].name + ' responds slower than usual, ' + slowServices[0].slow_ms + ' ms instead of about ' + slowServices[0].slow_usual_ms + ' ms'
  } else if (slowServices.length > 1) {
    const labels = affectedLabels(
      slowServices.map(function (service) {
        return service.id
      }),
      services
    )
    if (labels.length === 1 && labels[0] === 'All') {
      slowNoticeText = 'All services respond slower than usual'
    } else {
      slowNoticeText = labels.join(', ') + ' respond slower than usual'
    }
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
        {lastCheckedAt && <LastChecked checkedAt={lastCheckedAt} renderedAt={renderedAt} />}
        <Link href="/incidents">Incident history <Arrow /></Link>
      </section>

      {downNoticeText && <Notice tone="red" kind="x" title="Service disruption" text={downNoticeText} />}

      {slowNoticeText && <Notice tone="amber" kind="gauge" title="Slower than usual" text={slowNoticeText} />}

      {ongoingIncidents.map(function (incident) {
        return (
          <Notice
            tone={incidentTone(incident.status, incident.severity)}
            kind="alert"
            title={incident.title}
            text={'Ongoing incident, ' + formatStatus(incident.status).toLowerCase()}
            href={'/incidents/' + incident.id}
            key={'incident-' + incident.id}
          />
        )
      })}

      {ongoingMaintenanceWindows.map(function (maintenanceWindow) {
        return (
          <Notice
            tone="blue"
            kind="wrench"
            title={maintenanceWindow.title}
            text={'Maintenance in progress, until ' + formatDateTimeShort(maintenanceWindow.scheduled_end, timezone)}
            href={'/maintenance/' + maintenanceWindow.id}
            key={'ongoing-maintenance-' + maintenanceWindow.id}
          />
        )
      })}

      {upcomingMaintenanceWindow && (
        <Notice
          tone="amber"
          kind="clock"
          title={upcomingMaintenanceWindow.title}
          text={'Scheduled maintenance, ' + formatWindow(upcomingMaintenanceWindow.scheduled_start, upcomingMaintenanceWindow.scheduled_end, timezone)}
          href={'/maintenance/' + upcomingMaintenanceWindow.id}
        />
      )}

      <section className="live-status">
        <div className="live-status-head">
          <h2>Live Status</h2>
          {services.length > 0 && (
            <p>
              Uptime over the past 60 days. <Link href="/uptime">View historical uptime</Link>
            </p>
          )}
        </div>
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
                maintenanceServiceIds={maintenanceServiceIds}
                defaultOpen={isFirst}
                dayNote={dayNote}
                key={groupName}
              />
            )
          })}
        </div>
      </section>

      {responseTimes && services.length > 0 && (
        <ResponseChart
          initial={responseTimes}
          services={services.map(function (service) {
            return { id: service.id, name: service.name }
          })}
          timezone={timezone}
        />
      )}

      <PastIncidents incidents={pastIncidents} timezone={timezone} now={renderedAt} />
    </>
  )
}