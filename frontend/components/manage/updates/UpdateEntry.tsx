'use client'

import { startTransition, useActionState, useState } from 'react'
import type { FormState } from '@/app/manage/actions'
import { useConfirm } from '@/components/manage/confirm/Confirm'
import { useSuccessToast } from '@/components/manage/toast/Toasts'
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
  canEdit,
  canDelete,
  editAction,
  deleteAction,
}: {
  parentId: number
  update: StatusUpdate
  timezone: string
  statuses: string[]
  canEdit: boolean
  canDelete: boolean
  editAction: UpdateAction
  deleteAction: UpdateAction
}) {
  const [editing, setEditing] = useState(false)
  const [saveState, saveFormAction, saving] = useActionState(editAction, initialState)
  useSuccessToast(saveState)
  const { formRef: saveFormRef, onSubmit: saveSubmit } = useFormSubmit(saveFormAction, saveState)
  const [deleteState, deleteFormAction, deleting] = useActionState(deleteAction, initialState)

  function toggleEditing() {
    setEditing(!editing)
  }

  const confirm = useConfirm()

  function confirmDelete(event: React.MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form
    if (!form) {
      return
    }
    const formData = new FormData(form)
    confirm({
      title: 'Delete this update?',
      message: 'It disappears from the status page too.',
      confirmText: 'Delete update',
      danger: true,
    }).then(function (ok) {
      if (ok) {
        startTransition(function () {
          deleteFormAction(formData)
        })
      }
    })
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
        {canEdit && (
          <button type="button" className="link-button" onClick={toggleEditing}>
            {editLabel}
          </button>
        )}
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
            {deleteState.error && <p className="form-error" role="alert">{deleteState.error}</p>}
            <div className="form-actions spread">
              {canDelete && (
                <button
                  type="button"
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
