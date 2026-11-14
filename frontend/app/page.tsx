import ServiceSection from '@/components/status/ServiceSection'
import { AlertSmall, AlertTriangle, Arrow, Check, Tool, X } from '@/components/icons'
import { getIncidents, getStatus, getAllMaintenance, getUptime } from '@/lib/api'
import type { Incident, MaintenanceWindow, ServiceStatus, UptimeStats } from '@/lib/types'

function formatMaintenanceWindow(startIso: string, endIso: string) {
  const start = new Date(startIso)
  const end = new Date(endIso)

  const dateText = start.toLocaleDateString('en-GB', { month: 'long', day: 'numeric', timeZone: 'UTC' })
  const startTime = start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' })
  const endTime = end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' })

  return dateText + ', ' + startTime + '-' + endTime + ' UTC'
}

export default async function Home() {
  var services: ServiceStatus[] = []
  var maintenanceWindows: MaintenanceWindow[] = []
  var incidents: Incident[] = []
  var uptimeResults: UptimeStats[] = []
  var backendIsDown = false

  try {
    services = await getStatus()
    maintenanceWindows = await getAllMaintenance()
    incidents = await getIncidents()
    uptimeResults = await Promise.all(
      services.map(function (service) {
        return getUptime(service.id)
      })
    )
  } catch (error) {
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

  const uptimeByServiceId = new Map<string, number>()
  var i = 0
  while (i < services.length) {
    uptimeByServiceId.set(services[i].id, uptimeResults[i].uptime_percent)
    i = i + 1
  }

  const groups = new Map<string, ServiceStatus[]>()
  for (const service of services) {
    var groupName = service.group_name
    if (!groupName) {
      groupName = 'Other'
    }
    if (!groups.has(groupName)) {
      groups.set(groupName, [])
    }
    groups.get(groupName)!.push(service)
  }

  var allOnline = true
  for (const service of services) {
    if (service.status !== 'online') {
      allOnline = false
    }
  }

  var heroCheckClassName = 'operational-check'
  var heroText = 'Operational'
  if (!allOnline) {
    heroCheckClassName = 'operational-check down'
    heroText = 'Degraded'
  }

  const now = new Date()

  const ongoingIncidents: Incident[] = []
  for (const incident of incidents) {
    if (incident.status !== 'resolved') {
      ongoingIncidents.push(incident)
    }
  }

  const ongoingMaintenanceWindows: MaintenanceWindow[] = []
  for (const maintenanceWindow of maintenanceWindows) {
    if (maintenanceWindow.status === 'in_progress') {
      ongoingMaintenanceWindows.push(maintenanceWindow)
    }
  }

  var upcomingMaintenanceWindow: MaintenanceWindow | null = null
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
          {!allOnline && <X size={34} />}
          {allOnline && <Check size={34} />}
        </span>
        <h1>{heroText}</h1>
        <a href="/incidents">Incident history <Arrow /></a>
      </section>

      {ongoingIncidents.map(function (incident) {
        return (
          <section className="notice incident" key={'incident-' + incident.id}>
            <span className="notice-icon incident">
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
          <section className="notice ongoing-maintenance" key={'ongoing-maintenance-' + maintenanceWindow.id}>
            <span className="notice-icon ongoing-maintenance">
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
        <section className="notice scheduled">
          <span className="notice-icon scheduled">
            <AlertTriangle />
          </span>
          <div className="notice-copy">
            <h2>Scheduled maintenance</h2>
            <p className="scheduled-text">
              {upcomingMaintenanceWindow.title} - {formatMaintenanceWindow(upcomingMaintenanceWindow.scheduled_start, upcomingMaintenanceWindow.scheduled_end)}
            </p>
          </div>
          <a className="text-button" href={'/maintenance/' + upcomingMaintenanceWindow.id}>
            View details <Arrow />
          </a>
        </section>
      )}

      <section className="live-status">
        <h2>Live Status</h2>
        <div className="live-service-list">
          {groupEntries.map(function (entry, index) {
            const groupName = entry[0]
            const groupServices = entry[1]
            var isFirst = false
            if (index === 0) {
              isFirst = true
            }

            return (
              <ServiceSection
                groupName={groupName}
                services={groupServices}
                uptimeByServiceId={uptimeByServiceId}
                defaultOpen={isFirst}
                key={groupName}
              />
            )
          })}
        </div>
      </section>
    </>
  )
}