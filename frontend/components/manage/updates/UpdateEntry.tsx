'use client'

import { useActionState, useState } from 'react'
import type { FormState } from '@/app/manage/actions'
import { formatDateTime, formatStatus } from '@/lib/format'
import type { StatusUpdate } from '@/lib/types'
import { useFormSubmit } from '@/lib/use-form-submit'

const initialState: FormState = { error: null, success: null }

type UpdateAction = (state: FormState, formData: FormData) => Promise<FormState>

export default function UpdateEntry({
  parentId,
  update,
  timezone,
  statuses,
  canDelete,
  editAction,
  deleteAction,
}: {
  parentId: number
  update: StatusUpdate
  timezone: string
  statuses: string[]
  canDelete: boolean
  editAction: UpdateAction
  deleteAction: UpdateAction
}) {
  const [editing, setEditing] = useState(false)
  const [saveState, saveFormAction, saving] = useActionState(editAction, initialState)
  const { formRef: saveFormRef, onSubmit: saveSubmit } = useFormSubmit(saveFormAction, saveState)
  const [deleteState, deleteFormAction, deleting] = useActionState(deleteAction, initialState)

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

  let statusOptions = statuses
  if (!statuses.includes(update.status)) {
    statusOptions = [update.status].concat(statuses)
  }

  return (
    <li className={'manage-update status-' + update.status}>
      <div className="manage-update-head">
        <span className={'status-chip status-' + update.status}>{formatStatus(update.status)}</span>
        <time>{formatDateTime(update.created_at, timezone)}</time>
        <button type="button" className="link-button" onClick={toggleEditing}>
          {editLabel}
        </button>
      </div>

      {!editing && <p>{update.message}</p>}

      {editing && (
        <div className="manage-update-edit">
          <form ref={saveFormRef} action={saveFormAction} onSubmit={saveSubmit} className="manage-form">
            <input type="hidden" name="id" value={parentId} />
            <input type="hidden" name="update_id" value={update.id} />
            <label>
              <span>Status</span>
              <select name="status" defaultValue={update.status}>
                {statusOptions.map(function (value) {
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
            {deleteState.error && <p className="form-error" role="alert">{deleteState.error}</p>}
            <div className="form-actions spread">
              {canDelete && (
                <button
                  type="submit"
                  formAction={deleteFormAction}
                  formNoValidate
                  className="button-danger"
                  disabled={deleting}
                  onClick={confirmDelete}
                >
                  Delete update
                </button>
              )}
              <button type="submit" className="button-primary" disabled={saving}>
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </li>
  )
}
