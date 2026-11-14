import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertSmall, Check, ChevronLeft, PendingRing } from '@/components/icons'
import { getIncidents, getServiceNames } from '@/lib/api'

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
  const incidentId = Number(id)

  const incidents = await getIncidents()

  var incident = null
  for (const candidate of incidents) {
    if (candidate.id === incidentId) {
      incident = candidate
    }
  }

  if (!incident) {
    notFound()
  }

  var tagClassName = 'scheduled-tag'
  var tagLabel = capitalize(incident.status)
  if (incident.status === 'resolved') {
    tagClassName = 'resolved-tag'
    tagLabel = 'Resolved'
  }

  const serviceNames = await getServiceNames()
  var affectedServices: string[] = []
  if (incident.affected_services) {
    affectedServices = incident.affected_services
  }

  var hasResolvedEntry = false
  if (incident.status === 'resolved' && incident.resolved_at) {
    hasResolvedEntry = true
  }

  var isOngoing = false
  var reportedMarkerClassName = 'update-marker pending'
  if (incident.status !== 'resolved') {
    isOngoing = true
    reportedMarkerClassName = 'update-marker ongoing-incident'
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

        <div className="detail-updates">
          {hasResolvedEntry && incident.resolved_at && (
            <div className="detail-update">
              <span className="update-marker done">
                <Check size={11} />
              </span>
              <div className="update-card">
                <div>
                  <strong>Resolved</strong>
                  <time>{formatDateTime(incident.resolved_at)}</time>
                </div>
                <p>{incident.description}</p>
              </div>
            </div>
          )}

          <div className="detail-update">
            <span className={reportedMarkerClassName}>
              {isOngoing && <AlertSmall />}
              {!isOngoing && <PendingRing />}
            </span>
            <div className="update-card">
              <div>
                <strong>Reported</strong>
                <time>{formatDateTime(incident.created_at)}</time>
              </div>
              <p>{incident.description}</p>
            </div>
          </div>
        </div>
      </article>
    </div>
  )
}