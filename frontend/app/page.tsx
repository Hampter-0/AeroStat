import ServiceSection from '@/components/status/ServiceSection'
import { Arrow, Calendar, Check, X } from '@/components/icons'
import { getStatus, getUpcomingMaintenance, getUptime } from '@/lib/api'
import type { MaintenanceWindow, ServiceStatus, UptimeStats } from '@/lib/types'

function formatMaintenanceWindow(startIso: string, endIso: string) {
  const start = new Date(startIso)
  const end = new Date(endIso)

  const dateText = start.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' })
  const startTime = start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' })
  const endTime = end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' })

  return dateText + ', ' + startTime + '-' + endTime + ' UTC'
}

export default async function Home() {
  var services: ServiceStatus[] = []
  var maintenanceWindows: MaintenanceWindow[] = []
  var uptimeResults: UptimeStats[] = []
  var backendIsDown = false

  try {
    services = await getStatus()
    maintenanceWindows = await getUpcomingMaintenance()
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
        <p>We cant check the current status of our services right now. Please check back in a moment.</p>
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

  var nextMaintenance = null
  if (maintenanceWindows.length > 0) {
    nextMaintenance = maintenanceWindows[0]
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

      {nextMaintenance && (
        <section className="notice">
          <span className="maintenance-icon">
            <Calendar />
          </span>
          <div className="notice-copy">
            <h2>Scheduled maintenance</h2>
            <p>
              {nextMaintenance.title} - {formatMaintenanceWindow(nextMaintenance.scheduled_start, nextMaintenance.scheduled_end)}
            </p>
          </div>
          <a className="text-button" href="/maintenance">View details <Arrow /></a>
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