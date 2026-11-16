'use client'

import { useActionState, useState } from 'react'
import type { FormState } from '@/app/manage/actions'
import { deleteGroup, moveGroup, renameGroup } from '@/app/manage/(panel)/services/actions'
import MoveButtons from './MoveButtons'
import { useConfirmedSubmit } from '@/components/manage/confirm/Confirm'
import { useFormSubmit } from '@/lib/use-form-submit'

const initialState: FormState = { error: null, success: null }

export default function GroupHeader({
  id,
  name,
  serviceCount,
  isFirst,
  isLast,
  canEdit,
  canDelete,
}: {
  id: string
  name: string
  serviceCount: number
  isFirst: boolean
  isLast: boolean
  canEdit: boolean
  canDelete: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [renameState, renameAction, renaming] = useActionState(renameGroup, initialState)
  const { formRef: renameFormRef, onSubmit: renameSubmit } = useFormSubmit(renameAction, renameState)
  const [deleteState, deleteAction, deleting] = useActionState(deleteGroup, initialState)

  function toggleEditing() {
    setEditing(!editing)
  }

  let deleteMessage = 'This cannot be undone.'
  if (serviceCount > 0) {
    deleteMessage = 'Its ' + serviceCount + ' service(s) are kept and move to "Other".'
  }
  const confirmDelete = useConfirmedSubmit(deleteAction, {
    title: 'Delete the group "' + name + '"?',
    message: deleteMessage,
    confirmText: 'Delete group',
    danger: true,
  })

  let renameLabel = 'Rename'
  if (editing) {
    renameLabel = 'Cancel'
  }

  return (
    <div className="group-header">
      {!editing && <h2>{name}</h2>}
      {editing && (
        <form ref={renameFormRef} action={renameAction} onSubmit={renameSubmit} className="inline-form">
          <input type="hidden" name="id" value={id} />
          <input name="name" defaultValue={name} required maxLength={100} aria-label="Group name" autoFocus />
          <button type="submit" className="button-primary" disabled={renaming}>
            Save
          </button>
        </form>
      )}
      {(canEdit || canDelete) && (
        <div className="group-header-actions">
          {canEdit && (
            <button type="button" className="link-button" onClick={toggleEditing}>
              {renameLabel}
            </button>
          )}
          {canDelete && (
            <form action={deleteAction} onSubmit={confirmDelete}>
              <input type="hidden" name="id" value={id} />
              <button type="submit" className="link-button danger" disabled={deleting}>
                Delete
              </button>
            </form>
          )}
          {canEdit && <MoveButtons id={id} label={name} isFirst={isFirst} isLast={isLast} action={moveGroup} />}
        </div>
      )}
      {renameState.error && <p className="form-error" role="alert">{renameState.error}</p>}
      {deleteState.error && <p className="form-error" role="alert">{deleteState.error}</p>}
    </div>
  )
}
