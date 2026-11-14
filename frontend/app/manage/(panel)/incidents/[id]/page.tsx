import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft, ExternalLink } from '@/components/icons'
import DeleteIncidentForm from '@/components/manage/incidents/DeleteIncidentForm'
import IncidentForm from '@/components/manage/incidents/IncidentForm'
import PostUpdateForm from '@/components/manage/incidents/PostUpdateForm'
import UpdateEntry from '@/components/manage/incidents/UpdateEntry'
import { getIncident, getStatus } from '@/lib/api'
import { formatDateTime, formatStatus } from '@/lib/format'
import { can, requireUser } from '@/lib/manage'

export const metadata = {
  title: 'Incident',
}

export default async function ManageIncidentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  if (!can(user, 'incidents')) {
    redirect('/manage')
  }

  const { id } = await params
  const incident = await getIncident(id)
  if (!incident) {
    notFound()
  }
  const services = await getStatus()

  let canDeleteUpdates = false
  if (incident.updates.length > 1) {
    canDeleteUpdates = true
  }

  return (
    <div className="manage-page">
      <Link href="/manage/incidents" className="back-button">
        <ChevronLeft /> Incidents
      </Link>

      <header className="manage-page-header with-action">
        <div>
          <span className={'status-chip status-' + incident.status}>{formatStatus(incident.status)}</span>
          <h1>{incident.title}</h1>
          <p>Reported {formatDateTime(incident.created_at)}</p>
        </div>
        <a href={'/incidents/' + incident.id} target="_blank" className="button-secondary">
          <ExternalLink /> View public page
        </a>
      </header>

      <section className="manage-panel">
        <h2>Post an update</h2>
        <PostUpdateForm incidentId={incident.id} currentStatus={incident.status} />
      </section>

      <section className="manage-panel">
        <h2>Timeline</h2>
        <ol className="manage-timeline">
          {incident.updates.map(function (update) {
            return (
              <UpdateEntry
                key={update.id + '-' + update.status + '-' + update.message}
                incidentId={incident.id}
                update={update}
                canDelete={canDeleteUpdates}
              />
            )
          })}
        </ol>
      </section>

      <section className="manage-panel">
        <h2>Details</h2>
        <IncidentForm services={services} incident={incident} />
      </section>

      <section className="manage-panel danger">
        <h2>Delete incident</h2>
        <DeleteIncidentForm incidentId={incident.id} />
      </section>
    </div>
  )
}
