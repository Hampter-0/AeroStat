'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import type { FormState } from '@/app/manage/actions'
import { createUser, updateUser } from '@/app/manage/(panel)/users/actions'
import PermissionTree from '@/components/manage/roles/PermissionTree'
import type { PermissionGroup, PermissionUser, RoleSummary } from '@/lib/permissions'
import { canGiveRole, roleDescription, type UserRecord } from '@/lib/users'

const initialState: FormState = { error: null, success: null }

export default function UserForm({
  user,
  roles,
  groups,
  actor,
  isSelf,
}: {
  user: UserRecord | null
  roles: RoleSummary[]
  groups: PermissionGroup[]
  actor: PermissionUser
  isSelf: boolean
}) {
  let action = createUser
  if (user) {
    action = updateUser
  }
  const [state, formAction, pending] = useActionState(action, initialState)
  const formRef = useRef<HTMLFormElement>(null)

  let email = ''
  let userId = ''
  let startRoles: number[] = []
  let startPermissions: string[] = []
  let startSuper = false
  if (user) {
    userId = String(user.id)
    startRoles = user.role_ids
    startPermissions = user.permissions
    startSuper = user.super_user
    if (user.email) {
      email = user.email
    }
  }
  const [assigned, setAssigned] = useState<number[]>(startRoles)
  const [extra, setExtra] = useState<string[]>(startPermissions)
  const [directSuper, setDirectSuper] = useState(startSuper)

  function changeSuper(event: React.ChangeEvent<HTMLInputElement>) {
    setDirectSuper(event.target.checked)
  }

  const keepOwnDirectSuper = isSelf && startSuper
  let superHint = 'Can do everything in the panel, including managing users and roles, without needing a role.'
  if (keepOwnDirectSuper) {
    superHint = superHint + ' You can’t take this away from yourself.'
  } else if (!actor.is_admin) {
    superHint = superHint + ' Only a super user can change this.'
  }

  useEffect(
    function () {
      const form = formRef.current
      if (!form) {
        return
      }
      for (const field of form.querySelectorAll<HTMLInputElement>('input[type="password"]')) {
        field.value = ''
      }
    },
    [state],
  )

  const fromRoles: string[] = []
  let superUser = directSuper
  for (const role of roles) {
    if (assigned.includes(role.id)) {
      if (role.super_user) {
        superUser = true
      }
      for (const permission of role.permissions) {
        if (!fromRoles.includes(permission)) {
          fromRoles.push(permission)
        }
      }
    }
  }

  let saveText = 'Create user'
  let pendingText = 'Creating…'
  if (user) {
    saveText = 'Save changes'
    pendingText = 'Saving…'
  }
  if (pending) {
    saveText = pendingText
  }

  return (
    <form ref={formRef} action={formAction} className="manage-form">
      <input type="hidden" name="id" value={userId} />
      <section className="manage-panel">
        <h2>Account</h2>
        {!user && (
          <div className="form-row">
            <label>
              <span>Username</span>
              <input name="username" autoComplete="off" required minLength={2} maxLength={32} pattern="[a-zA-Z0-9._\-]+" />
            </label>
            <label>
              <span>Password</span>
              <input name="password" type="password" autoComplete="new-password" required minLength={8} />
              <small className="field-hint">At least 8 characters.</small>
            </label>
          </div>
        )}
        <label>
          <span>Email</span>
          <input name="email" type="email" autoComplete="off" defaultValue={email} placeholder="Optional" />
          <small className="field-hint">For email notifications. They can change it on their profile.</small>
        </label>
        {user && (
          <label>
            <span>New password</span>
            <input name="password" type="password" autoComplete="new-password" minLength={8} placeholder="Leave empty to keep the current password" />
          </label>
        )}
        <label className="check-row hint-row">
          <input
            type="checkbox"
            name="super_user"
            checked={directSuper}
            onChange={changeSuper}
            disabled={!actor.is_admin || keepOwnDirectSuper}
          />
          {keepOwnDirectSuper && <input type="hidden" name="super_user" value="on" />}
          <span>
            <strong>Super user</strong>
            <small>{superHint}</small>
          </span>
        </label>
      </section>

      <section className="manage-panel">
        <h2>Roles</h2>
        {roles.length === 0 && <p className="manage-empty">There are no roles yet. Create one under Roles first.</p>}
        <div className="permission-tree">
          {roles.map(function (role) {
            const has = assigned.includes(role.id)
            const keepOwnSuper = isSelf && role.super_user && startRoles.includes(role.id)
            const canGive = canGiveRole(actor, role)
            const disabled = !canGive || keepOwnSuper
            let hint = roleDescription(role)
            if (keepOwnSuper) {
              hint = hint + '. You can’t take this away from yourself.'
            } else if (!canGive) {
              hint = hint + '. It has rights you don’t have.'
            }
            function change(event: React.ChangeEvent<HTMLInputElement>) {
              if (event.target.checked) {
                setAssigned(assigned.concat([role.id]))
              } else {
                setAssigned(
                  assigned.filter(function (id) {
                    return id !== role.id
                  }),
                )
              }
            }
            return (
              <label className="check-row hint-row" key={role.id}>
                <input type="checkbox" checked={has} onChange={change} disabled={disabled} />
                <span>
                  <strong>{role.name}</strong>
                  <small>{hint}</small>
                </span>
              </label>
            )
          })}
        </div>
        {assigned.map(function (id) {
          return <input type="hidden" name="role_ids" value={id} key={id} />
        })}
      </section>

      {superUser && (
        <section className="manage-panel">
          <p className="manage-empty">A super user can do everything, so there are no extra permissions to pick.</p>
        </section>
      )}
      {!superUser && (
        <PermissionTree
          title="Extra permissions"
          groups={groups}
          actor={actor}
          selected={extra}
          onChange={setExtra}
          disabled={false}
          locked={fromRoles}
        />
      )}

      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      {state.success && <p className="form-success" role="status">{state.success}</p>}
      <div className="form-actions">
        <button type="submit" className="button-primary" disabled={pending}>
          {saveText}
        </button>
      </div>
    </form>
  )
}
