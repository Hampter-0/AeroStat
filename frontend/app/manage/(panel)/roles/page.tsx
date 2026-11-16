import Link from 'next/link'
import { redirect } from 'next/navigation'
import { can, manageFetch, requireUser } from '@/lib/manage'
import type { PermissionGroup, Role } from '@/lib/permissions'

export const metadata = {
  title: 'Roles',
}

interface RolesResponse {
  roles: Role[]
  permission_groups: PermissionGroup[]
}

export default async function RolesPage() {
  const user = await requireUser()
  if (!can(user, 'roles.view')) {
    redirect('/manage')
  }

  const data = await manageFetch<RolesResponse>('/roles')
  let rolesText = data.roles.length + ' roles'
  if (data.roles.length === 1) {
    rolesText = '1 role'
  }
  let openText = 'View'
  if (can(user, 'roles.edit')) {
    openText = 'Edit'
  }

  return (
    <div className="manage-page">
      <header className="manage-page-header with-action">
        <div>
          <h1>Roles</h1>
          <p>A role is a set of permissions. Give users one or more roles to decide what they can do.</p>
        </div>
        {can(user, 'roles.create') && (
          <Link href="/manage/roles/new" className="button-primary">
            Create role
          </Link>
        )}
      </header>

      <section className="manage-panel activity-panel">
        <div className="activity-bar">
          <p>{rolesText}</p>
        </div>
        {data.roles.length === 0 && <p className="manage-empty activity-empty">No roles yet.</p>}
        {data.roles.length > 0 && (
          <div className="activity-table-wrap">
            <table className="activity-table roles-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Handle</th>
                  <th>Access</th>
                  <th>Users</th>
                  <th>
                    <span className="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.roles.map(function (role) {
                  let access = <span className="table-muted">{role.permissions.length} permissions</span>
                  if (role.permissions.length === 1) {
                    access = <span className="table-muted">1 permission</span>
                  }
                  if (role.super_user) {
                    access = <span className="chip admin">Super user</span>
                  }
                  return (
                    <tr key={role.id}>
                      <td>
                        <strong>{role.name}</strong>
                      </td>
                      <td>
                        <code>{role.handle}</code>
                      </td>
                      <td>{access}</td>
                      <td className="table-muted">{role.users}</td>
                      <td className="table-action">
                        <Link href={'/manage/roles/' + role.id} className="button-secondary">
                          {openText}
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
