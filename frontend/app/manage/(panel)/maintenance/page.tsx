import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAffectedLabeler, getAllMaintenance } from '@/lib/api'
import { formatDateTime, formatStatus } from '@/lib/format'
import { maintenanceTone } from '@/lib/maintenance'
import { getSiteConfig } from '@/lib/branding'
import { can, requireUser } from '@/lib/manage'
import type { MaintenanceWindow } from '@/lib/types'
import PageHeader from '@/components/manage/PageHeader'
import StateBadge from '@/components/StateBadge'
import { MaintenanceIcon } from '@/components/status/EventMarker'

export const metadata = {
  title: 'Maintenance',
}

function MaintenanceList({
  items,
  labelsOf,
  timezone,
}: {
  items: MaintenanceWindow[]
  labelsOf: (affected: string[] | null) => string[]
  timezone: string
}) {
  return (
    <div className="manage-list">
      {items.map(function (item) {
        const names = labelsOf(item.affected_services)
        return (
          <Link href={'/manage/maintenance/' + item.id} className="manage-list-row" key={item.id}>
            <MaintenanceIcon status={item.status} />
            <div>
              <strong>{item.title}</strong>
              <span>
                {names.join(', ')}, {formatDateTime(item.scheduled_start, timezone)}
              </span>
            </div>
            <StateBadge tone={maintenanceTone(item.status)}>{formatStatus(item.status)}</StateBadge>
          </Link>
        )
      })}
    </div>
  )
}

export default async function ManageMaintenancePage() {
  const user = await requireUser()
  if (!can(user, 'maintenance.view')) {
    redirect('/manage')
  }

  const items = await getAllMaintenance()
  const { timezone } = await getSiteConfig()
  const labelsOf = await getAffectedLabeler()

  const inProgress: MaintenanceWindow[] = []
  const upcoming: MaintenanceWindow[] = []
  const past: MaintenanceWindow[] = []
  for (const item of items) {
    if (item.status === 'in_progress') {
      inProgress.push(item)
    } else if (item.status === 'scheduled') {
      upcoming.push(item)
    } else {
      past.push(item)
    }
  }
  upcoming.reverse()

  return (
    <div className="manage-page">
      <PageHeader
        title="Maintenance"
        description="Plan work ahead so visitors know what to expect."
        action={
          can(user, 'maintenance.create') && (
            <Link href="/manage/maintenance/new" className="button-primary">
              Schedule maintenance
            </Link>
          )
        }
      />

      {inProgress.length > 0 && (
        <section className="manage-panel">
          <h2>In progress</h2>
          <MaintenanceList items={inProgress} labelsOf={labelsOf} timezone={timezone} />
        </section>
      )}

      <section className="manage-panel">
        <h2>Upcoming</h2>
        {upcoming.length === 0 && <p className="manage-empty">Nothing planned.</p>}
        {upcoming.length > 0 && <MaintenanceList items={upcoming} labelsOf={labelsOf} timezone={timezone} />}
      </section>

      <section className="manage-panel">
        <h2>Past & cancelled</h2>
        {past.length === 0 && <p className="manage-empty">Nothing here yet.</p>}
        {past.length > 0 && <MaintenanceList items={past} labelsOf={labelsOf} timezone={timezone} />}
      </section>
    </div>
  )
}
