'use client'

import { useState } from 'react'
import { PERMISSION_LABELS } from '@/lib/permissions'

export default function PermissionFields({
  permissions,
  initialAdmin,
  initialSelected,
  adminLocked,
}: {
  permissions: string[]
  initialAdmin: boolean
  initialSelected: string[]
  adminLocked: boolean
}) {
  const [isAdmin, setIsAdmin] = useState(initialAdmin)

  function toggleAdmin(event: React.ChangeEvent<HTMLInputElement>) {
    setIsAdmin(event.target.checked)
  }

  let adminHint = 'Full access, including managing users.'
  if (adminLocked) {
    adminHint = 'You can’t remove your own admin rights.'
  }

  return (
    <fieldset className="permission-fields">
      <label className="check-row admin-row">
        <input type="checkbox" name="is_admin" checked={isAdmin} onChange={toggleAdmin} disabled={adminLocked} />
        <span>
          <strong>Admin</strong>
          <small>{adminHint}</small>
        </span>
      </label>
      {adminLocked && <input type="hidden" name="is_admin" value="on" />}
      <div className="permission-grid">
        {permissions.map(function (permission) {
          const label = PERMISSION_LABELS[permission] || permission
          if (isAdmin) {
            return (
              <label className="check-row" key={permission + '-admin'}>
                <input type="checkbox" checked disabled readOnly />
                <span>{label}</span>
              </label>
            )
          }
          return (
            <label className="check-row" key={permission}>
              <input type="checkbox" name="permissions" value={permission} defaultChecked={initialSelected.includes(permission)} />
              <span>{label}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
