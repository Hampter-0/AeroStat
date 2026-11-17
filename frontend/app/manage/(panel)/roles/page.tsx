import Link from 'next/link'
import { redirect } from 'next/navigation'
import RolesTable from '@/components/manage/roles/RolesTable'
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
        {data.roles.length === 0 && <p className="manage-empty activity-empty">No roles yet.</p>}
        {data.roles.length > 0 && <RolesTable roles={data.roles} openText={openText} />}
      </section>
    </div>
  )
}
