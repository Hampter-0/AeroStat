'use client'

import { useActionState, useState } from 'react'
import type { FormState } from '@/app/manage/actions'
import { deleteGroup, moveGroup, renameGroup } from '@/app/manage/(panel)/services/actions'
import MoveButtons from './MoveButtons'

const initialState: FormState = { error: null, success: null }

export default function GroupHeader({
  id,
  name,
  serviceCount,
  isFirst,
  isLast,
}: {
  id: string
  name: string
  serviceCount: number
  isFirst: boolean
  isLast: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [renameState, renameAction, renaming] = useActionState(renameGroup, initialState)
  const [deleteState, deleteAction, deleting] = useActionState(deleteGroup, initialState)

  function toggleEditing() {
    setEditing(!editing)
  }

  function confirmDelete(event: React.FormEvent<HTMLFormElement>) {
    let message = 'Delete the group "' + name + '"?'
    if (serviceCount > 0) {
      message = message + ' Its ' + serviceCount + ' service(s) are kept and move to "Other".'
    }
    if (!window.confirm(message)) {
      event.preventDefault()
    }
  }

  let renameLabel = 'Rename'
  if (editing) {
    renameLabel = 'Cancel'
  }

  return (
    <div className="group-header">
      {!editing && <h2>{name}</h2>}
      {editing && (
        <form action={renameAction} className="inline-form">
          <input type="hidden" name="id" value={id} />
          <input name="name" defaultValue={name} required maxLength={100} aria-label="Group name" autoFocus />
          <button type="submit" className="button-primary" disabled={renaming}>
            Save
          </button>
        </form>
      )}
      <div className="group-header-actions">
        <button type="button" className="link-button" onClick={toggleEditing}>
          {renameLabel}
        </button>
        <form action={deleteAction} onSubmit={confirmDelete}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" className="link-button danger" disabled={deleting}>
            Delete
          </button>
        </form>
        <MoveButtons id={id} label={name} isFirst={isFirst} isLast={isLast} action={moveGroup} />
      </div>
      {renameState.error && <p className="form-error" role="alert">{renameState.error}</p>}
      {deleteState.error && <p className="form-error" role="alert">{deleteState.error}</p>}
    </div>
  )
}
