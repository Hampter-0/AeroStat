'use client'

import { useActionState, useState } from 'react'
import { deleteUser, updateUser, type FormState } from '@/app/manage/actions'
import { PERMISSION_LABELS } from '@/lib/permissions'
import PermissionFields from './PermissionFields'
import { useFormSubmit } from '@/lib/use-form-submit'

const initialState: FormState = { error: null, success: null }

interface UserRecord {
  id: number
  username: string
  email: string | null
  is_admin: boolean
  permissions: string[]
  created_at: string
}

export default function UserRow({
  user,
  permissions,
  isSelf,
}: {
  user: UserRecord
  permissions: string[]
  isSelf: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [saveState, saveAction, saving] = useActionState(updateUser, initialState)
  const { formRef: saveFormRef, onSubmit: saveSubmit } = useFormSubmit(saveAction, saveState)
  const [deleteState, deleteAction, deleting] = useActionState(deleteUser, initialState)

  function toggleEditing() {
    setEditing(!editing)
  }

  function confirmDelete(event: React.FormEvent<HTMLFormElement>) {
    if (!window.confirm('Delete ' + user.username + '? They will be signed out immediately.')) {
      event.preventDefault()
    }
  }

  const accessLabels: string[] = []
  if (user.is_admin) {
    accessLabels.push('Admin')
  } else {
    for (const permission of user.permissions) {
      accessLabels.push(PERMISSION_LABELS[permission] || permission)
    }
  }

  let editLabel = 'Edit'
  if (editing) {
    editLabel = 'Close'
  }

  let email = ''
  if (user.email) {
    email = user.email
  }

  let saveText = 'Save changes'
  if (saving) {
    saveText = 'Saving…'
  }

  return (
    <article className="user-row">
      <div className="user-row-summary">
        <div className="user-row-name">
          <span className="user-row-names">
            <span className="user-row-title">
              <strong>{user.username}</strong>
              {isSelf && <span className="you-tag">You</span>}
            </span>
            {user.email && <small>{user.email}</small>}
          </span>
        </div>
        <div className="user-row-access">
          {accessLabels.length === 0 && <span className="chip muted">No access</span>}
          {accessLabels.map(function (label) {
            let chipClass = 'chip'
            if (label === 'Admin') {
              chipClass = 'chip admin'
            }
            return (
              <span className={chipClass} key={label}>
                {label}
              </span>
            )
          })}
        </div>
        <button type="button" className="button-secondary" onClick={toggleEditing} aria-expanded={editing}>
          {editLabel}
        </button>
      </div>

      {editing && (
        <div className="user-row-edit">
          <form ref={saveFormRef} action={saveAction} onSubmit={saveSubmit} className="manage-form">
            <input type="hidden" name="id" value={user.id} />
            <PermissionFields
              permissions={permissions}
              initialAdmin={user.is_admin}
              initialSelected={user.permissions}
              adminLocked={isSelf}
            />
            <label>
              <span>Email</span>
              <input key={'email-' + email} name="email" type="email" autoComplete="off" defaultValue={email} placeholder="No email address" />
            </label>
            <label>
              <span>New password</span>
              <input name="password" type="password" autoComplete="new-password" minLength={8} placeholder="Leave empty to keep the current password" />
            </label>
            {saveState.error && <p className="form-error" role="alert">{saveState.error}</p>}
            {saveState.success && <p className="form-success" role="status">{saveState.success}</p>}
            <div className="form-actions">
              <button type="submit" className="button-primary" disabled={saving}>
                {saveText}
              </button>
            </div>
          </form>

          {!isSelf && (
            <form action={deleteAction} onSubmit={confirmDelete} className="danger-zone">
              <input type="hidden" name="id" value={user.id} />
              {deleteState.error && <p className="form-error" role="alert">{deleteState.error}</p>}
              <button type="submit" className="button-danger" disabled={deleting}>
                Delete user
              </button>
            </form>
          )}
        </div>
      )}
    </article>
  )
}
