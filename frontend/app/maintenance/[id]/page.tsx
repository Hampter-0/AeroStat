import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Check, ChevronLeft, PendingRing, Tool } from '@/components/icons'
import { getAllMaintenance, getServiceNames } from '@/lib/api'

function formatFullDate(iso: string) {
  const date = new Date(iso)
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function formatTimeRange(startIso: string, endIso: string) {
  const start = new Date(startIso)
  const end = new Date(endIso)
  const startTime = start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' })
  const endTime = end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' })
  return startTime + '-' + endTime + ' UTC'
}

function formatDateTime(iso: string) {
  const date = new Date(iso)
  const dateText = formatFullDate(iso)
  const timeText = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' })
  return dateText + ' at ' + timeText + ' UTC'
}

export default async function MaintenanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const maintenanceId = Number(id)

  const maintenanceWindows = await getAllMaintenance()

  var maintenanceWindow = null
  for (const candidate of maintenanceWindows) {
    if (candidate.id === maintenanceId) {
      maintenanceWindow = candidate
    }
  }

  if (!maintenanceWindow) {
    notFound()
  }

  const now = new Date()
  const start = new Date(maintenanceWindow.scheduled_start)
  const end = new Date(maintenanceWindow.scheduled_end)

  var tagClassName = 'scheduled-tag'
  var tagLabel = 'Scheduled'
  var isCompleted = false
  var isOngoing = false
  var isCancelled = false

  if (maintenanceWindow.status === 'in_progress') {
    tagClassName = 'in-progress-tag'
    tagLabel = 'In progress'
    isOngoing = true
  } else if (maintenanceWindow.status === 'completed') {
    tagClassName = 'completed-tag'
    tagLabel = 'Completed'
    isCompleted = true
  } else if (maintenanceWindow.status === 'cancelled') {
    tagClassName = 'cancelled-tag'
    tagLabel = 'Cancelled'
    isCancelled = true
  }

  var topMarkerClassName = 'update-marker pending'
  if (isCompleted) {
    topMarkerClassName = 'update-marker done'
  }
  if (isOngoing) {
    topMarkerClassName = 'update-marker ongoing-maintenance'
  }
  if (isCancelled) {
    topMarkerClassName = 'update-marker pending'
  }

  const serviceNames = await getServiceNames()
  var affectedServices: string[] = []
  if (maintenanceWindow.affected_services) {
    affectedServices = maintenanceWindow.affected_services
  }

  return (
    <div className="detail-page">
      <Link href="/maintenance" className="back-button">
        <ChevronLeft /> Back to overview
      </Link>
      <article className="detail-card">
        <header className="detail-header">
          <span className={tagClassName}>{tagLabel}</span>
          <h1>{maintenanceWindow.title}</h1>
          <p>
            {formatFullDate(maintenanceWindow.scheduled_start)}, {formatTimeRange(maintenanceWindow.scheduled_start, maintenanceWindow.scheduled_end)}
          </p>
        </header>

        <div className="affected-row">
          <span>Affected services</span>
          <div>
            {affectedServices.map(function (serviceId) {
              return (
                <span className="service-chip" key={serviceId}>
                  {serviceNames.get(serviceId) || serviceId}
                </span>
              )
            })}
          </div>
        </div>

        <div className="detail-updates">
          <div className="detail-update">
            <span className={topMarkerClassName}>
              {isCompleted && <Check size={11} />}
              {isOngoing && <Tool size={11} />}
              {!isCompleted && !isOngoing && <PendingRing />}
            </span>
            <div className="update-card">
              <div>
                <strong>{tagLabel}</strong>
                <time>{formatDateTime(maintenanceWindow.scheduled_start)}</time>
              </div>
              <p>{maintenanceWindow.description}</p>
            </div>
          </div>

          <div className="detail-update">
            <span className="update-marker pending">
              <PendingRing />
            </span>
            <div className="update-card">
              <div>
                <strong>Created</strong>
                <time>{formatDateTime(maintenanceWindow.created_at)}</time>
              </div>
              <p>{maintenanceWindow.description}</p>
            </div>
          </div>
        </div>
      </article>
    </div>
  )
}