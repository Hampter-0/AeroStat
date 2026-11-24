import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Check, ChevronLeft, PendingRing } from '@/components/icons'
import Timeline, { type TimelineEntry } from '@/components/detail/Timeline'
import { getAffectedLabels, getIncident } from '@/lib/api'
import { incidentTone } from '@/lib/incidents'
import { getSiteConfig } from '@/lib/branding'
import { getDisplayTime } from '@/lib/visitor-time'
import { formatDateTimeLong, formatDayLong } from '@/lib/time'
import StateBadge from '@/components/StateBadge'
import { formatStatus } from '@/lib/format'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const incident = await getIncident(id)
  const config = await getSiteConfig()
  if (!incident) {
    return { title: 'Incident not found' }
  }
  let description = config.description
  if (incident.updates.length > 0) {
    description = incident.updates[0].message
  } else if (incident.description) {
    description = incident.description
  }
  return {
    title: incident.title,
    description: description,
    openGraph: { type: 'article', siteName: config.siteName, title: incident.title + ' | ' + config.siteName, description: description },
  }
}

export default async function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const incident = await getIncident(id)
  const { timezone } = await getDisplayTime()

  function formatFullDate(iso: string) {
    return formatDayLong(iso, timezone)
  }

  function formatDateTime(iso: string) {
    return formatDateTimeLong(iso, timezone)
  }

  if (!incident) {
    notFound()
  }

  const tagTone = incidentTone(incident.status, incident.severity)
  const tagLabel = formatStatus(incident.status)

  const affectedServices = await getAffectedLabels(incident.affected_services)

  const entries: TimelineEntry[] = []
  if (incident.updates.length > 0) {
    incident.updates.forEach(function (update) {
      let markerClassName = 'update-marker pending'
      let icon = <PendingRing />
      if (update.status === 'resolved') {
        markerClassName = 'update-marker done'
        icon = <Check size={11} />
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
    entries.push({
      key: 'reported',
      label: 'Reported',
      time: formatDateTime(incident.created_at),
      message: incident.description,
      markerClassName: 'update-marker pending',
      icon: <PendingRing />,
    })
  }

  return (
    <div className="detail-page">
      <Link href="/incidents" className="back-button">
        <ChevronLeft /> Back to overview
      </Link>
      <article className="detail-card">
        <header className="detail-header">
          <StateBadge tone={tagTone}>{tagLabel}</StateBadge>
          <h1>{incident.title}</h1>
          <p>{formatFullDate(incident.created_at)}</p>
        </header>

        <div className="affected-row">
          <span>Affected services</span>
          <div>
            {affectedServices.map(function (label) {
              return (
                <span className="service-chip" key={label}>
                  {label}
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