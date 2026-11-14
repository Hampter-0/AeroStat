import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft, ExternalLink } from '@/components/icons'
import DeleteForm from '@/components/manage/DeleteForm'
import CancelMaintenanceForm from '@/components/manage/maintenance/CancelMaintenanceForm'
import MaintenanceForm from '@/components/manage/maintenance/MaintenanceForm'
import PostUpdateForm from '@/components/manage/updates/PostUpdateForm'
import UpdateEntry from '@/components/manage/updates/UpdateEntry'
import { getMaintenance, getStatus } from '@/lib/api'
import { formatDateTime, formatStatus } from '@/lib/format'
import { MAINTENANCE_HINTS, MAINTENANCE_UPDATE_STATUSES } from '@/lib/maintenance'
import { can, requireUser } from '@/lib/manage'
import {
  deleteMaintenance,
  deleteMaintenanceUpdate,
  editMaintenanceUpdate,
  postMaintenanceUpdate,
} from '../actions'

export const metadata = {
  title: 'Maintenance',
}

export default async function ManageMaintenanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  if (!can(user, 'maintenance')) {
    redirect('/manage')
  }

  const { id } = await params
  const maintenance = await getMaintenance(id)
  if (!maintenance) {
    notFound()
  }
  const services = await getStatus()

  let isCancelled = false
  if (maintenance.status === 'cancelled') {
    isCancelled = true
  }

  let updateStatus = maintenance.status
  if (isCancelled) {
    updateStatus = 'scheduled'
  }

  return (
    <div className="manage-page">
      <Link href="/manage/maintenance" className="back-button">
        <ChevronLeft /> Maintenance
      </Link>

      <header className="manage-page-header with-action">
        <div>
          <span className={'status-chip status-' + maintenance.status}>{formatStatus(maintenance.status)}</span>
          <h1>{maintenance.title}</h1>
          <p>
            {formatDateTime(maintenance.scheduled_start)} – {formatDateTime(maintenance.scheduled_end)}
          </p>
        </div>
        <a href={'/maintenance/' + maintenance.id} target="_blank" className="button-secondary">
          <ExternalLink /> View public page
        </a>
      </header>

      <section className="manage-panel">
        <h2>Post an update</h2>
        <PostUpdateForm
          parentId={maintenance.id}
          currentStatus={updateStatus}
          statuses={MAINTENANCE_UPDATE_STATUSES}
          hints={MAINTENANCE_HINTS}
          action={postMaintenanceUpdate}
        />
      </section>

      <section className="manage-panel">
        <h2>Timeline</h2>
        {maintenance.updates.length === 0 && <p className="manage-empty">No updates yet.</p>}
        <ol className="manage-timeline">
          {maintenance.updates.map(function (update) {
            return (
              <UpdateEntry
                key={update.id + '-' + update.status + '-' + update.message}
                parentId={maintenance.id}
                update={update}
                statuses={MAINTENANCE_UPDATE_STATUSES}
                canDelete={true}
                editAction={editMaintenanceUpdate}
                deleteAction={deleteMaintenanceUpdate}
              />
            )
          })}
        </ol>
      </section>

      <section className="manage-panel">
        <h2>Details</h2>
        <MaintenanceForm services={services} maintenance={maintenance} />
      </section>

      <section className="manage-panel danger">
        <h2>Cancel maintenance</h2>
        <CancelMaintenanceForm id={maintenance.id} cancelled={isCancelled} />
      </section>

      <section className="manage-panel danger">
        <h2>Delete maintenance</h2>
        <DeleteForm
          id={maintenance.id}
          action={deleteMaintenance}
          buttonText="Delete maintenance"
          description="Deleting removes it and its timeline from the status page. To keep a record, cancel it instead."
          confirmText="Delete this maintenance and all its updates? This cannot be undone."
        />
      </section>
    </div>
  )
}
