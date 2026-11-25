import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from '@/components/icons'
import { maintenanceGlyph } from '@/components/status/EventMarker'
import Timeline, { type TimelineEntry } from '@/components/detail/Timeline'
import { getAffectedLabels, getMaintenance } from '@/lib/api'
import { maintenanceTone } from '@/lib/maintenance'
import { getSiteConfig } from '@/lib/branding'
import { getDisplayTime } from '@/lib/visitor-time'
import { formatDateTimeLong, formatWindow } from '@/lib/time'
import StateBadge from '@/components/StateBadge'
import { formatStatus } from '@/lib/format'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const maintenance = await getMaintenance(id)
  const config = await getSiteConfig()
  if (!maintenance) {
    return { title: 'Maintenance not found' }
  }
  let description = formatWindow(maintenance.scheduled_start, maintenance.scheduled_end, config.timezone)
  if (maintenance.description) {
    description = maintenance.description + ', ' + description
  }
  return {
    title: maintenance.title,
    description: description,
    openGraph: { type: 'article', siteName: config.siteName, title: maintenance.title + ' | ' + config.siteName, description: description },
  }
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

  const tagTone = maintenanceTone(maintenanceWindow.status)
  const tagLabel = formatStatus(maintenanceWindow.status)

  const affectedServices = await getAffectedLabels(maintenanceWindow.affected_services)

  const entries: TimelineEntry[] = []
  if (maintenanceWindow.updates.length > 0) {
    maintenanceWindow.updates.forEach(function (update) {
      entries.push({
        key: 'update-' + update.id,
        label: formatStatus(update.status),
        time: formatDateTime(update.created_at),
        message: update.message,
        tone: maintenanceTone(update.status),
        kind: maintenanceGlyph(update.status),
      })
    })
  } else {
    entries.push({
      key: 'status',
      label: tagLabel,
      time: formatDateTime(maintenanceWindow.scheduled_start),
      message: maintenanceWindow.description,
      tone: maintenanceTone(maintenanceWindow.status),
      kind: maintenanceGlyph(maintenanceWindow.status),
    })
    entries.push({
      key: 'created',
      label: 'Created',
      time: formatDateTime(maintenanceWindow.created_at),
      message: null,
      tone: 'gray',
      kind: 'clock',
    })
  }

  return (
    <div className="detail-page">
      <Link href="/maintenance" className="back-button">
        <ChevronLeft /> Back to overview
      </Link>
      <article className="detail-card">
        <header className="detail-header">
          <StateBadge tone={tagTone}>{tagLabel}</StateBadge>
          <h1>{maintenanceWindow.title}</h1>
          <p>
            {formatWindow(maintenanceWindow.scheduled_start, maintenanceWindow.scheduled_end, timezone)}
          </p>
        </header>

        {affectedServices.length > 0 && (
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
        )}

        <Timeline entries={entries} />
      </article>
    </div>
  )
}