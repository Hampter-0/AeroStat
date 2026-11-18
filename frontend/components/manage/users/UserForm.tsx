'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import type { FormState } from '@/app/manage/actions'
import { createUser, updateUser } from '@/app/manage/(panel)/users/actions'
import PermissionTree from '@/components/manage/roles/PermissionTree'
import { useResultToast } from '@/components/manage/toast/Toasts'
import type { PermissionGroup, PermissionUser, RoleSummary } from '@/lib/permissions'
import { useKeepValuesSubmit } from '@/lib/use-form-submit'
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
  const onSubmit = useKeepValuesSubmit(formAction)
  useResultToast(state)
  const formRef = useRef<HTMLFormElement>(null)

  let email = ''
  let userId = ''
  let startRoles: number[] = []
  let startPermissions: string[] = []
  let startSuper = false
  let startRequired = false
  let startSuspended = false
  if (user) {
    userId = String(user.id)
    startRoles = user.role_ids
    startPermissions = user.permissions
    startSuper = user.super_user
    startRequired = user.two_factor_required
    startSuspended = user.suspended
    if (user.email) {
      email = user.email
    }
  }
  const [assigned, setAssigned] = useState<number[]>(startRoles)
  const [extra, setExtra] = useState<string[]>(startPermissions)
  const [directSuper, setDirectSuper] = useState(startSuper)
  const [required, setRequired] = useState(startRequired)
  const [suspended, setSuspended] = useState(startSuspended)

  function changeSuspended(event: React.ChangeEvent<HTMLInputElement>) {
    setSuspended(event.target.checked)
  }

  function changeRequired(event: React.ChangeEvent<HTMLInputElement>) {
    setRequired(event.target.checked)
  }

  function changeSuper(event: React.ChangeEvent<HTMLInputElement>) {
    setDirectSuper(event.target.checked)
  }

  const keepOwnDirectSuper = isSelf && startSuper
  let superHint = 'Full access to everything in the panel, including users, roles and settings. Roles don’t matter for an admin.'
  if (keepOwnDirectSuper) {
    superHint = superHint + ' You can’t take this away from yourself.'
  } else if (!actor.is_admin) {
    superHint = superHint + ' Only an admin can change this.'
  }
  let canSuspend = false
  if (user && !isSelf && !user.owner) {
    canSuspend = true
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
  const superUser = directSuper
  for (const role of roles) {
    if (assigned.includes(role.id)) {
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
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className="manage-form">
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
          <input name="email" type="email" autoComplete="off" defaultValue={email} placeholder="Optional" readOnly={isSelf} />
          {!isSelf && <small className="field-hint">For email notifications. They can change it on their profile.</small>}
          {isSelf && <small className="field-hint">Change your own email on your profile, where it asks for your password.</small>}
        </label>
        {user && !isSelf && (
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
            <strong>Admin</strong>
            <small>{superHint}</small>
          </span>
        </label>
        <label className="check-row hint-row">
          <input type="checkbox" name="two_factor_required" checked={required} onChange={changeRequired} disabled={isSelf} />
          {isSelf && startRequired && <input type="hidden" name="two_factor_required" value="on" />}
          <span>
            <strong>Require two-factor sign-in</strong>
            {!isSelf && (
              <small>
                They must turn on an authenticator app or email codes, or sign in with passkeys only, before they can use the
                panel.
              </small>
            )}
            {isSelf && <small>Someone else has to change this for your own account.</small>}
          </span>
        </label>
        {canSuspend && (
          <label className="check-row hint-row">
            <input type="checkbox" name="suspended" checked={suspended} onChange={changeSuspended} />
            <span>
              <strong>Suspended</strong>
              <small>They can’t sign in and get no notifications. Suspending signs them out right away.</small>
            </span>
          </label>
        )}
      </section>

      <section className="manage-panel">
        <h2>Roles</h2>
        {roles.length === 0 && <p className="manage-empty">There are no roles yet. Create one under Roles first.</p>}
        <div className="permission-tree">
          {roles.map(function (role) {
            const has = assigned.includes(role.id)
            const canGive = canGiveRole(actor, role)
            const disabled = !canGive
            let hint = roleDescription(role)
            if (!canGive) {
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
          <p className="manage-empty">An admin can do everything, so there are no extra permissions to pick.</p>
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

      <div className="form-actions">
        <button type="submit" className="button-primary" disabled={pending}>
          {saveText}
        </button>
      </div>
    </form>
  )
}
