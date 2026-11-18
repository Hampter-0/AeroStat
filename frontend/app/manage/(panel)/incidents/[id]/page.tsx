import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft, ExternalLink } from '@/components/icons'
import DeleteForm from '@/components/manage/DeleteForm'
import IncidentForm from '@/components/manage/incidents/IncidentForm'
import PostUpdateForm from '@/components/manage/updates/PostUpdateForm'
import UpdateEntry from '@/components/manage/updates/UpdateEntry'
import { getIncident, getStatus } from '@/lib/api'
import { formatDateTime, formatStatus } from '@/lib/format'
import { INCIDENT_STATUSES, STATUS_HINTS } from '@/lib/incidents'
import { getSiteConfig } from '@/lib/branding'
import { can, requireUser } from '@/lib/manage'
import { deleteIncident, deleteUpdate, editUpdate, postUpdate } from '../actions'

export const metadata = {
  title: 'Incident',
}

export default async function ManageIncidentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  if (!can(user, 'incidents.view')) {
    redirect('/manage')
  }

  const { id } = await params
  const incident = await getIncident(id)
  if (!incident) {
    notFound()
  }
  const services = await getStatus()
  const { timezone } = await getSiteConfig()

  const canEdit = can(user, 'incidents.edit')
  let canDeleteUpdates = false
  if (canEdit && incident.updates.length > 1) {
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
          <p>Started {formatDateTime(incident.created_at, timezone)}</p>
        </div>
        <a href={'/incidents/' + incident.id} target="_blank" className="button-secondary">
          <ExternalLink /> View public page
        </a>
      </header>

      {can(user, 'incidents.update') && (
        <section className="manage-panel">
          <h2>Post an update</h2>
          <PostUpdateForm
            parentId={incident.id}
            currentStatus={incident.status}
            statuses={INCIDENT_STATUSES}
            hints={STATUS_HINTS}
            action={postUpdate}
            timezone={timezone}
          />
        </section>
      )}

      <section className="manage-panel">
        <h2>Timeline</h2>
        <ol className="manage-timeline">
          {incident.updates.map(function (update) {
            return (
              <UpdateEntry
                key={update.id + '-' + update.status + '-' + update.message + '-' + update.created_at}
                parentId={incident.id}
                update={update}
                timezone={timezone}
                statuses={INCIDENT_STATUSES}
                canEdit={canEdit}
                canDelete={canDeleteUpdates}
                canMoveTime={true}
                editAction={editUpdate}
                deleteAction={deleteUpdate}
              />
            )
          })}
        </ol>
      </section>

      {canEdit && (
        <section className="manage-panel">
          <h2>Details</h2>
          <IncidentForm key={incident.created_at + '-' + incident.resolved_at} services={services} incident={incident} timezone={timezone} />
        </section>
      )}

      {can(user, 'incidents.delete') && (
        <section className="manage-panel danger">
          <h2>Delete incident</h2>
          <DeleteForm
            id={incident.id}
            action={deleteIncident}
            buttonText="Delete incident"
            description="Deleting removes the incident and its whole timeline from the status page."
            confirmText="Delete this incident and all its updates? This removes it from the status page and cannot be undone."
          />
        </section>
      )}
    </div>
  )
}
