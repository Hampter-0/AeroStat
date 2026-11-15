import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Check, ChevronLeft, PendingRing, Tool } from '@/components/icons'
import Timeline, { type TimelineEntry } from '@/components/detail/Timeline'
import { getMaintenance, getServiceNames } from '@/lib/api'
import { getDisplayTime } from '@/lib/visitor-time'
import { formatDateTimeLong, formatWindow } from '@/lib/time'

function formatStatus(status: string) {
  const text = status.replace('_', ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export default async function MaintenanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const maintenanceWindow = await getMaintenance(id)
  const { timezone } = await getDisplayTime()

  function formatDateTime(iso: string) {
    return formatDateTimeLong(iso, timezone)
  }

  if (!maintenanceWindow) {
    notFound()
  }

  let tagClassName = 'scheduled-tag'
  let tagLabel = 'Scheduled'
  let isCompleted = false
  let isOngoing = false

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
  }

  const serviceNames = await getServiceNames()
  let affectedServices: string[] = []
  if (maintenanceWindow.affected_services) {
    affectedServices = maintenanceWindow.affected_services
  }

  const entries: TimelineEntry[] = []
  if (maintenanceWindow.updates.length > 0) {
    maintenanceWindow.updates.forEach(function (update) {
      let markerClassName = 'update-marker pending'
      let icon = <PendingRing />
      if (update.status === 'completed') {
        markerClassName = 'update-marker done'
        icon = <Check size={11} />
      } else if (update.status === 'in_progress') {
        markerClassName = 'update-marker ongoing-maintenance'
        icon = <Tool size={11} />
      }
      entries.push({
        key: 'update-' + update.id,
        label: formatStatus(update.status),
        time: formatDateTime(update.created_at),
        message: update.message,
        markerClassName: markerClassName,
        icon: icon,
      })
    })
  } else {
    let topMarkerClassName = 'update-marker pending'
    let topIcon = <PendingRing />
    if (isCompleted) {
      topMarkerClassName = 'update-marker done'
      topIcon = <Check size={11} />
    }
    if (isOngoing) {
      topMarkerClassName = 'update-marker ongoing-maintenance'
      topIcon = <Tool size={11} />
    }
    entries.push({
      key: 'status',
      label: tagLabel,
      time: formatDateTime(maintenanceWindow.scheduled_start),
      message: maintenanceWindow.description,
      markerClassName: topMarkerClassName,
      icon: topIcon,
    })
    entries.push({
      key: 'created',
      label: 'Created',
      time: formatDateTime(maintenanceWindow.created_at),
      message: null,
      markerClassName: 'update-marker pending',
      icon: <PendingRing />,
    })
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
            {formatWindow(maintenanceWindow.scheduled_start, maintenanceWindow.scheduled_end, timezone)}
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

        <Timeline entries={entries} />
      </article>
    </div>
  )
}