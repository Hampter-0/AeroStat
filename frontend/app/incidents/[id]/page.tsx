import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertSmall, Check, ChevronLeft, PendingRing } from '@/components/icons'
import Timeline, { type TimelineEntry } from '@/components/detail/Timeline'
import { getIncident, getServiceNames } from '@/lib/api'

function formatFullDate(iso: string) {
  const date = new Date(iso)
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function formatDateTime(iso: string) {
  const date = new Date(iso)
  const dateText = formatFullDate(iso)
  const timeText = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' })
  return dateText + ' at ' + timeText + ' UTC'
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export default async function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const incident = await getIncident(id)

  if (!incident) {
    notFound()
  }

  let tagClassName = 'scheduled-tag'
  let tagLabel = capitalize(incident.status)
  if (incident.status === 'resolved') {
    tagClassName = 'resolved-tag'
    tagLabel = 'Resolved'
  }

  const serviceNames = await getServiceNames()
  let affectedServices: string[] = []
  if (incident.affected_services) {
    affectedServices = incident.affected_services
  }

  let isOngoing = false
  if (incident.status !== 'resolved') {
    isOngoing = true
  }

  const entries: TimelineEntry[] = []
  if (incident.updates.length > 0) {
    incident.updates.forEach(function (update, index) {
      let markerClassName = 'update-marker pending'
      let icon = <PendingRing />
      if (update.status === 'resolved') {
        markerClassName = 'update-marker done'
        icon = <Check size={11} />
      } else if (index === 0 && isOngoing) {
        markerClassName = 'update-marker ongoing-incident'
        icon = <AlertSmall />
      }
      entries.push({
        key: 'update-' + update.id,
        label: capitalize(update.status),
        time: formatDateTime(update.created_at),
        message: update.message,
        markerClassName: markerClassName,
        icon: icon,
      })
    })
  } else {
    if (incident.status === 'resolved' && incident.resolved_at) {
      entries.push({
        key: 'resolved',
        label: 'Resolved',
        time: formatDateTime(incident.resolved_at),
        message: null,
        markerClassName: 'update-marker done',
        icon: <Check size={11} />,
      })
    }
    let reportedMarkerClassName = 'update-marker pending'
    let reportedIcon = <PendingRing />
    if (isOngoing) {
      reportedMarkerClassName = 'update-marker ongoing-incident'
      reportedIcon = <AlertSmall />
    }
    entries.push({
      key: 'reported',
      label: 'Reported',
      time: formatDateTime(incident.created_at),
      message: incident.description,
      markerClassName: reportedMarkerClassName,
      icon: reportedIcon,
    })
  }

  return (
    <div className="detail-page">
      <Link href="/incidents" className="back-button">
        <ChevronLeft /> Back to overview
      </Link>
      <article className="detail-card">
        <header className="detail-header">
          <span className={tagClassName}>{tagLabel}</span>
          <h1>{incident.title}</h1>
          <p>{formatFullDate(incident.created_at)}</p>
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