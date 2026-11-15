import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getIncidents, getServiceNames } from '@/lib/api'
import { formatDateTime, formatStatus } from '@/lib/format'
import { getSiteConfig } from '@/lib/branding'
import { can, requireUser } from '@/lib/manage'
import type { Incident } from '@/lib/types'

export const metadata = {
  title: 'Incidents',
}

function IncidentList({
  incidents,
  serviceNames,
  timezone,
}: {
  incidents: Incident[]
  serviceNames: Map<string, string>
  timezone: string
}) {
  return (
    <div className="manage-list">
      {incidents.map(function (incident) {
        const names: string[] = []
        for (const serviceId of incident.affected_services || []) {
          names.push(serviceNames.get(serviceId) || serviceId)
        }
        return (
          <Link href={'/manage/incidents/' + incident.id} className="manage-list-row" key={incident.id}>
            <div>
              <strong>{incident.title}</strong>
              <span>
                {names.join(', ')} · {formatDateTime(incident.created_at, timezone)}
              </span>
            </div>
            <span className={'status-chip status-' + incident.status}>{formatStatus(incident.status)}</span>
          </Link>
        )
      })}
    </div>
  )
}

export default async function ManageIncidentsPage() {
  const user = await requireUser()
  if (!can(user, 'incidents')) {
    redirect('/manage')
  }

  const incidents = await getIncidents()
  const { timezone } = await getSiteConfig()
  const serviceNames = await getServiceNames()

  const ongoing: Incident[] = []
  const resolved: Incident[] = []
  for (const incident of incidents) {
    if (incident.status === 'resolved') {
      resolved.push(incident)
    } else {
      ongoing.push(incident)
    }
  }

  return (
    <div className="manage-page">
      <header className="manage-page-header with-action">
        <div>
          <h1>Incidents</h1>
          <p>Report problems and keep visitors posted with updates.</p>
        </div>
        <Link href="/manage/incidents/new" className="button-primary">
          New incident
        </Link>
      </header>

      <section className="manage-panel">
        <h2>Ongoing</h2>
        {ongoing.length === 0 && <p className="manage-empty">No ongoing incidents. All good!</p>}
        {ongoing.length > 0 && <IncidentList incidents={ongoing} serviceNames={serviceNames} timezone={timezone} />}
      </section>

      <section className="manage-panel">
        <h2>Resolved</h2>
        {resolved.length === 0 && <p className="manage-empty">Nothing resolved yet.</p>}
        {resolved.length > 0 && <IncidentList incidents={resolved} serviceNames={serviceNames} timezone={timezone} />}
      </section>
    </div>
  )
}
