'use client'

import { useActionState, useState } from 'react'
import type { FormState } from '@/app/manage/actions'
import { deleteUpdate, editUpdate } from '@/app/manage/(panel)/incidents/actions'
import { formatDateTime, formatStatus } from '@/lib/format'
import { INCIDENT_STATUSES } from '@/lib/incidents'
import type { StatusUpdate } from '@/lib/types'

const initialState: FormState = { error: null, success: null }

export default function UpdateEntry({
  incidentId,
  update,
  canDelete,
}: {
  incidentId: number
  update: StatusUpdate
  canDelete: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [saveState, saveAction, saving] = useActionState(editUpdate, initialState)
  const [deleteState, deleteAction, deleting] = useActionState(deleteUpdate, initialState)

  function toggleEditing() {
    setEditing(!editing)
  }

  function confirmDelete(event: React.MouseEvent<HTMLButtonElement>) {
    if (!window.confirm('Delete this update? It disappears from the status page too.')) {
      event.preventDefault()
    }
  }

  let editLabel = 'Edit'
  if (editing) {
    editLabel = 'Cancel'
  }

  return (
    <li className={'manage-update status-' + update.status}>
      <div className="manage-update-head">
        <span className={'status-chip status-' + update.status}>{formatStatus(update.status)}</span>
        <time>{formatDateTime(update.created_at)}</time>
        <button type="button" className="link-button" onClick={toggleEditing}>
          {editLabel}
        </button>
      </div>

      {!editing && <p>{update.message}</p>}

      {editing && (
        <div className="manage-update-edit">
          <form action={saveAction} className="manage-form">
            <input type="hidden" name="id" value={incidentId} />
            <input type="hidden" name="update_id" value={update.id} />
            <label>
              <span>Status</span>
              <select name="status" defaultValue={update.status}>
                {INCIDENT_STATUSES.map(function (value) {
                  return (
                    <option value={value} key={value}>
                      {formatStatus(value)}
                    </option>
                  )
                })}
              </select>
            </label>
            <label>
              <span>Message</span>
              <textarea name="message" rows={3} required defaultValue={update.message} />
            </label>
            {saveState.error && <p className="form-error" role="alert">{saveState.error}</p>}
            {saveState.success && <p className="form-success" role="status">{saveState.success}</p>}
            <div className="form-actions spread">
              {canDelete && (
                <button type="submit" formAction={deleteAction} className="button-danger" disabled={deleting} onClick={confirmDelete}>
                  Delete update
                </button>
              )}
              <button type="submit" className="button-primary" disabled={saving}>
                Save
              </button>
            </div>
            {deleteState.error && <p className="form-error" role="alert">{deleteState.error}</p>}
          </form>
        </div>
      )}
    </li>
  )
}
