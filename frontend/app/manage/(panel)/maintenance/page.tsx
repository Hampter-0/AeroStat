import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAllMaintenance, getServiceNames } from '@/lib/api'
import { formatDateTime, formatStatus } from '@/lib/format'
import { getSiteConfig } from '@/lib/branding'
import { can, requireUser } from '@/lib/manage'
import type { MaintenanceWindow } from '@/lib/types'

export const metadata = {
  title: 'Maintenance',
}

function MaintenanceList({
  items,
  serviceNames,
  timezone,
}: {
  items: MaintenanceWindow[]
  serviceNames: Map<string, string>
  timezone: string
}) {
  return (
    <div className="manage-list">
      {items.map(function (item) {
        const names: string[] = []
        for (const serviceId of item.affected_services || []) {
          names.push(serviceNames.get(serviceId) || serviceId)
        }
        return (
          <Link href={'/manage/maintenance/' + item.id} className="manage-list-row" key={item.id}>
            <div>
              <strong>{item.title}</strong>
              <span>
                {names.join(', ')} · {formatDateTime(item.scheduled_start, timezone)}
              </span>
            </div>
            <span className={'status-chip status-' + item.status}>{formatStatus(item.status)}</span>
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
  const serviceNames = await getServiceNames()

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
      <header className="manage-page-header with-action">
        <div>
          <h1>Maintenance</h1>
          <p>Plan work ahead so visitors know what to expect.</p>
        </div>
        {can(user, 'maintenance.create') && (
          <Link href="/manage/maintenance/new" className="button-primary">
            Schedule maintenance
          </Link>
        )}
      </header>

      {inProgress.length > 0 && (
        <section className="manage-panel">
          <h2>In progress</h2>
          <MaintenanceList items={inProgress} serviceNames={serviceNames} timezone={timezone} />
        </section>
      )}

      <section className="manage-panel">
        <h2>Upcoming</h2>
        {upcoming.length === 0 && <p className="manage-empty">Nothing planned.</p>}
        {upcoming.length > 0 && <MaintenanceList items={upcoming} serviceNames={serviceNames} timezone={timezone} />}
      </section>

      <section className="manage-panel">
        <h2>Past & cancelled</h2>
        {past.length === 0 && <p className="manage-empty">Nothing here yet.</p>}
        {past.length > 0 && <MaintenanceList items={past} serviceNames={serviceNames} timezone={timezone} />}
      </section>
    </div>
  )
}
