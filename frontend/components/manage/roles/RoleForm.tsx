'use client'

import { useActionState, useState } from 'react'
import type { FormState } from '@/app/manage/actions'
import { saveRole } from '@/app/manage/(panel)/roles/actions'
import { useResultToast } from '@/components/manage/toast/Toasts'
import type { PermissionGroup, PermissionUser, Role } from '@/lib/permissions'
import { useKeepValuesSubmit } from '@/lib/use-form-submit'
import PermissionTree from './PermissionTree'

const initialState: FormState = { error: null, success: null }

function toHandle(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}

export default function RoleForm({
  role,
  groups,
  actor,
  readOnly,
}: {
  role: Role | null
  groups: PermissionGroup[]
  actor: PermissionUser
  readOnly: boolean
}) {
  const [state, formAction, pending] = useActionState(saveRole, initialState)
  const onSubmit = useKeepValuesSubmit(formAction)
  useResultToast(state)

  let startName = ''
  let startHandle = ''
  let startSuper = false
  let startSelected: string[] = []
  if (role) {
    startName = role.name
    startHandle = role.handle
    startSuper = role.super_user
    startSelected = role.permissions
  }

  const [name, setName] = useState(startName)
  const [handle, setHandle] = useState(startHandle)
  const [handleTouched, setHandleTouched] = useState(role !== null)
  const [superUser, setSuperUser] = useState(startSuper)
  const [selected, setSelected] = useState<string[]>(startSelected)

  function changeName(event: React.ChangeEvent<HTMLInputElement>) {
    setName(event.target.value)
    if (!handleTouched) {
      setHandle(toHandle(event.target.value))
    }
  }

  function changeHandle(event: React.ChangeEvent<HTMLInputElement>) {
    setHandle(event.target.value)
    setHandleTouched(true)
  }

  function changeSuper(event: React.ChangeEvent<HTMLInputElement>) {
    setSuperUser(event.target.checked)
  }

  let saveText = 'Save role'
  if (pending) {
    saveText = 'Saving…'
  }

  let roleId = ''
  if (role) {
    roleId = String(role.id)
  }

  return (
    <form action={formAction} onSubmit={onSubmit} className="manage-form role-form">
      <input type="hidden" name="id" value={roleId} />

      <section className="manage-panel">
        <h2>Settings</h2>
        <div className="form-row">
          <label>
            <span>Title</span>
            <input name="name" value={name} onChange={changeName} required maxLength={50} placeholder="Editor" disabled={readOnly} />
            <small className="field-hint">A singular name, like &apos;Editor&apos; or &apos;Support&apos;.</small>
          </label>
          <label>
            <span>Handle</span>
            <input
              name="handle"
              value={handle}
              onChange={changeHandle}
              required
              maxLength={50}
              pattern="[a-z0-9_\-]+"
              placeholder="editor"
              disabled={readOnly}
            />
            <small className="field-hint">A unique id for this role: lowercase letters, digits, - and _.</small>
          </label>
        </div>
        <label className="check-row hint-row">
          <input type="checkbox" name="super_user" checked={superUser} onChange={changeSuper} disabled={readOnly || !actor.is_admin} />
          <span>
            <strong>Super user</strong>
            <small>Can do everything in the panel, including managing users and roles. Give this role wisely.</small>
          </span>
        </label>
      </section>

      {superUser && (
        <section className="manage-panel">
          <p className="manage-empty">A super user can do everything, so there are no permissions to pick.</p>
        </section>
      )}

      {!superUser && (
        <PermissionTree
          title="Permissions"
          groups={groups}
          actor={actor}
          selected={selected}
          onChange={setSelected}
          disabled={readOnly}
          locked={[]}
        />
      )}

      {!readOnly && (
        <div className="form-actions">
          <button type="submit" className="button-primary" disabled={pending}>
            {saveText}
          </button>
        </div>
      )}
    </form>
  )
}
