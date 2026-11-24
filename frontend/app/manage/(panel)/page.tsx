import Link from 'next/link'
import { AlertTriangle, Arrow, Check, ExternalLink, Tool, X } from '@/components/icons'
import ActivityList from '@/components/manage/ActivityList'
import CopyButton from '@/components/manage/CopyButton'
import ResponseSparkline, { type HourPoint } from '@/components/manage/dashboard/ResponseSparkline'
import type { ActivityResponse } from '@/lib/activity'
import type { ManageService, ManageServicesResponse } from '@/lib/services'
import { UPDATE_COMMAND, getVersionInfo } from '@/lib/version'
import { getAllMaintenance, getIncident, getIncidents, getStatus } from '@/lib/api'
import { getSiteConfig } from '@/lib/branding'
import { formatStatus } from '@/lib/format'
import { incidentTone } from '@/lib/incidents'
import { can, manageFetch, requireUser } from '@/lib/manage'
import { currentTimeMs, formatDateTimeShort, formatDuration } from '@/lib/time'
import type { IncidentDetail, MaintenanceWindow, ServiceStatus } from '@/lib/types'
import PageHeader from '@/components/manage/PageHeader'
import StateBadge from '@/components/StateBadge'
import { IncidentIcon, MaintenanceIcon } from '@/components/status/EventMarker'

interface DashboardData {
  response_times: { service_id: string; points: HourPoint[] }[]
  stats: { days: number; incidents: number; mean_minutes_to_resolve: number | null; downtime_minutes: number }
}

const UPCOMING_DAYS = 7
const RECENT_ACTIVITY = 8

function minutesText(minutes: number | null): string {
  if (minutes === null) {
    return '–'
  }
  if (minutes === 0) {
    return '0m'
  }
  return formatDuration(minutes * 60000)
}

export default async function ManageOverviewPage() {
  const user = await requireUser()
  const { timezone } = await getSiteConfig()
  const canIncidents = can(user, 'incidents.view')
  const canMaintenance = can(user, 'maintenance.view')
  const canServices = can(user, 'services.view')

  const services: ServiceStatus[] = await getStatus()
  const dashboard = await manageFetch<DashboardData>('/dashboard')
  const version = await getVersionInfo()
  let activity: ActivityResponse | null = null
  if (can(user, 'activity.view')) {
    activity = await manageFetch<ActivityResponse>('/activity?per_page=' + RECENT_ACTIVITY)
  }
  const now = currentTimeMs()

  const ongoing: IncidentDetail[] = []
  if (canIncidents) {
    for (const incident of await getIncidents()) {
      if (incident.status !== 'resolved') {
        const detail = await getIncident(String(incident.id))
        if (detail) {
          ongoing.push(detail)
        }
      }
    }
  }

  const inProgress: MaintenanceWindow[] = []
  const upcoming: MaintenanceWindow[] = []
  if (canMaintenance) {
    for (const item of await getAllMaintenance()) {
      if (item.status === 'in_progress') {
        inProgress.push(item)
      } else if (item.status === 'scheduled' && new Date(item.scheduled_start).getTime() - now < UPCOMING_DAYS * 86400000) {
        upcoming.push(item)
      }
    }
    upcoming.reverse()
  }

  const down: ServiceStatus[] = []
  for (const service of services) {
    if (service.status === 'offline') {
      down.push(service)
    }
  }

  const explained = new Set<string>()
  for (const incident of ongoing) {
    for (const serviceId of incident.affected_services || []) {
      explained.add(serviceId)
    }
  }
  for (const item of inProgress) {
    for (const serviceId of item.affected_services || []) {
      explained.add(serviceId)
    }
  }
  const unexplained: ServiceStatus[] = []
  for (const service of down) {
    if (!explained.has(service.id)) {
      unexplained.push(service)
    }
  }

  const serviceUrls = new Map<string, string>()
  const expiring: ManageService[] = []
  if (canServices) {
    const manageServices = await manageFetch<ManageServicesResponse>('/services')
    for (const service of manageServices.services) {
      serviceUrls.set(service.id, service.url)
      if (service.cert_expires_at && service.cert_warn_days) {
        const left = new Date(service.cert_expires_at).getTime() - now
        if (left < service.cert_warn_days * 86400000) {
          expiring.push(service)
        }
      }
    }
    expiring.sort(function (a, b) {
      return new Date(a.cert_expires_at || 0).getTime() - new Date(b.cert_expires_at || 0).getTime()
    })
  }

  let statusClass = 'dashboard-status ok'
  let statusTitle = 'All systems operational'
  let statusText = services.length + ' services, all online'
  let statusIcon = <Check size={22} />
  const inMaintenance = new Set<string>()
  for (const item of inProgress) {
    for (const serviceId of item.affected_services || []) {
      inMaintenance.add(serviceId)
    }
  }
  const realDown: ServiceStatus[] = []
  const maintenanceDown: ServiceStatus[] = []
  for (const service of down) {
    if (inMaintenance.has(service.id)) {
      maintenanceDown.push(service)
    } else {
      realDown.push(service)
    }
  }
  if (maintenanceDown.length > 0) {
    statusClass = 'dashboard-status maintenance'
    statusTitle = maintenanceDown.length + ' of ' + services.length + ' services in maintenance'
    statusText = maintenanceDown
      .map(function (service) {
        return service.name
      })
      .join(', ')
    statusIcon = <Tool size={20} />
  }
  if (realDown.length > 0) {
    statusClass = 'dashboard-status down'
    statusTitle = realDown.length + ' of ' + services.length + ' services down'
    statusText = realDown
      .map(function (service) {
        return service.name
      })
      .join(', ')
    statusIcon = <X size={22} />
  }

  const names = new Map<string, string>()
  for (const service of services) {
    names.set(service.id, service.name)
  }

  return (
    <div className="manage-page">
      <PageHeader
        title={<>Welcome, {user.username}</>}
      />

      {can(user, 'system.view') && version && version.update_available && (
        <section className="update-notice">
          <div>
            <strong>AeroStat v{version.latest} is available</strong>
            <span>
              You are on v{version.current}. Run <code>{UPDATE_COMMAND}</code> next to your docker-compose.yml to update.
            </span>
          </div>
          <div className="update-notice-actions">
            {version.release_url && (
              <a href={version.release_url} target="_blank" rel="noreferrer" className="link-button">
                What&apos;s new <ExternalLink />
              </a>
            )}
            <Link href="/manage/system?tab=updates" className="link-button">
              Version history
            </Link>
            <CopyButton text={UPDATE_COMMAND} label="Copy update command" />
          </div>
        </section>
      )}

      <section className={statusClass}>
        <span className="dashboard-status-icon">{statusIcon}</span>
        <div>
          <strong>{statusTitle}</strong>
          <span>{statusText}</span>
        </div>
        <a href="/" target="_blank" className="dashboard-status-link">
          View status page <ExternalLink />
        </a>
      </section>

      {can(user, 'incidents.create') && unexplained.length > 0 && (
        <section className="manage-panel dashboard-warning">
          <h2>
            <AlertTriangle size={16} /> Down without an incident
          </h2>
          <p>Visitors see these services as down, but no incident or maintenance explains why.</p>
          <div className="manage-list">
            {unexplained.map(function (service) {
              return (
                <div className="manage-list-row" key={service.id}>
                  <div>
                    <strong>{service.name}</strong>
                    {serviceUrls.has(service.id) && <span>{serviceUrls.get(service.id)}</span>}
                  </div>
                  <Link href={'/manage/incidents/new?service=' + encodeURIComponent(service.id)} className="button-primary">
                    Create incident
                  </Link>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {expiring.length > 0 && (
        <section className="manage-panel dashboard-warning">
          <h2>
            <AlertTriangle size={16} /> Certificates run out soon
          </h2>
          <p>Renew these HTTPS certificates before they expire, or visitors get a security warning and the check fails.</p>
          <div className="manage-list">
            {expiring.map(function (service) {
              const left = new Date(service.cert_expires_at || 0).getTime() - now
              let leftText = 'Expired'
              if (left > 0) {
                leftText = 'Runs out in ' + formatDuration(left)
              }
              return (
                <Link
                  href={'/manage/services/' + encodeURIComponent(service.id)}
                  className="manage-list-row"
                  key={service.id}
                >
                  <div>
                    <strong>{service.name}</strong>
                    <span>
                      {leftText}, {formatDateTimeShort(service.cert_expires_at || '', timezone)}
                    </span>
                  </div>
                  <Arrow />
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {canIncidents && (
        <section className="manage-panel">
          <div className="panel-heading">
            <h2>Ongoing incidents</h2>
            {can(user, 'incidents.create') && (
              <Link href="/manage/incidents/new" className="link-button">
                + New incident
              </Link>
            )}
          </div>
          {ongoing.length === 0 && <p className="manage-empty">No ongoing incidents.</p>}
          <div className="manage-list">
            {ongoing.map(function (incident) {
              let latest = ''
              if (incident.updates.length > 0) {
                latest = incident.updates[0].message
              }
              const serviceNames: string[] = []
              for (const serviceId of incident.affected_services || []) {
                serviceNames.push(names.get(serviceId) || serviceId)
              }
              return (
                <Link href={'/manage/incidents/' + incident.id} className="manage-list-row dashboard-incident" key={incident.id}>
                  <IncidentIcon status={incident.status} severity={incident.severity} />
                  <div>
                    <strong>{incident.title}</strong>
                    <span>
                      {serviceNames.join(', ')}, running for {formatDuration(now - new Date(incident.created_at).getTime())}
                    </span>
                    {latest && <em>{latest}</em>}
                  </div>
                  <StateBadge tone={incidentTone(incident.status, incident.severity)}>{formatStatus(incident.status)}</StateBadge>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {canMaintenance && (
        <section className="manage-panel">
          <div className="panel-heading">
            <h2>Maintenance</h2>
            {can(user, 'maintenance.create') && (
              <Link href="/manage/maintenance/new" className="link-button">
                + Schedule
              </Link>
            )}
          </div>
          {inProgress.length === 0 && upcoming.length === 0 && (
            <p className="manage-empty">Nothing in progress or planned for the next {UPCOMING_DAYS} days.</p>
          )}
          <div className="manage-list">
            {inProgress.map(function (item) {
              return (
                <Link href={'/manage/maintenance/' + item.id} className="manage-list-row" key={item.id}>
                  <MaintenanceIcon status="in_progress" />
                  <div>
                    <strong>{item.title}</strong>
                    <span>Ends in {formatDuration(new Date(item.scheduled_end).getTime() - now)}</span>
                  </div>
                  <StateBadge tone="blue">In progress</StateBadge>
                </Link>
              )
            })}
            {upcoming.map(function (item) {
              return (
                <Link href={'/manage/maintenance/' + item.id} className="manage-list-row" key={item.id}>
                  <MaintenanceIcon status="scheduled" />
                  <div>
                    <strong>{item.title}</strong>
                    <span>
                      Starts in {formatDuration(new Date(item.scheduled_start).getTime() - now)},{' '}
                      {formatDateTimeShort(item.scheduled_start, timezone)}
                    </span>
                  </div>
                  <StateBadge tone="amber">Scheduled</StateBadge>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {canIncidents && (
        <section className="dashboard-stats" aria-label={'Last ' + dashboard.stats.days + ' days'}>
          <div className="stat-tile">
            <span>Incidents</span>
            <strong>{dashboard.stats.incidents}</strong>
            <small>last {dashboard.stats.days} days</small>
          </div>
          <div className="stat-tile">
            <span>Avg. time to resolve</span>
            <strong>{minutesText(dashboard.stats.mean_minutes_to_resolve)}</strong>
            <small>resolved incidents, last {dashboard.stats.days} days</small>
          </div>
          <div className="stat-tile">
            <span>Downtime</span>
            <strong>{minutesText(dashboard.stats.downtime_minutes)}</strong>
            <small>all services, last {dashboard.stats.days} days</small>
          </div>
        </section>
      )}

      <section className="manage-panel">
        <div className="panel-heading">
          <h2>Response time, last 24 hours</h2>
          {canServices && (
            <Link href="/manage/services" className="link-button">
              Services <Arrow />
            </Link>
          )}
        </div>
        <div className="sparkline-grid">
          {dashboard.response_times.map(function (series) {
            return (
              <ResponseSparkline
                key={series.service_id}
                name={names.get(series.service_id) || series.service_id}
                points={series.points}
                timezone={timezone}
              />
            )
          })}
        </div>
      </section>

      {activity && (
        <section className="manage-panel">
          <div className="panel-heading">
            <h2>Recent activity</h2>
            <Link href="/manage/activity" className="link-button">
              View all <Arrow />
            </Link>
          </div>
          {activity.entries.length === 0 && <p className="manage-empty">No changes yet.</p>}
          <ActivityList entries={activity.entries} timezone={timezone} showIp={false} />
        </section>
      )}
    </div>
  )
}
