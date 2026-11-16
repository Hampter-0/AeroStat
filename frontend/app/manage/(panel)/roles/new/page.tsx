import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from '@/components/icons'
import RoleForm from '@/components/manage/roles/RoleForm'
import { can, manageFetch, requireUser } from '@/lib/manage'
import type { PermissionGroup, Role } from '@/lib/permissions'

export const metadata = {
  title: 'Create role',
}

interface RolesResponse {
  roles: Role[]
  permission_groups: PermissionGroup[]
}

export default async function NewRolePage() {
  const user = await requireUser()
  if (!can(user, 'roles.create')) {
    redirect('/manage')
  }

  const data = await manageFetch<RolesResponse>('/roles')

  return (
    <div className="manage-page">
      <Link href="/manage/roles" className="back-button">
        <ChevronLeft /> Roles
      </Link>
      <header className="manage-page-header">
        <h1>Create role</h1>
        <p>Pick what people with this role can do. Ticking an action also ticks the view it needs.</p>
      </header>
      <RoleForm role={null} groups={data.permission_groups} actor={user} readOnly={false} />
    </div>
  )
}
