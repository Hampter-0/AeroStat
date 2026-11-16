import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft } from '@/components/icons'
import DeleteForm from '@/components/manage/DeleteForm'
import RoleForm from '@/components/manage/roles/RoleForm'
import { can, ManageApiError, manageFetch, requireUser } from '@/lib/manage'
import type { PermissionGroup, Role } from '@/lib/permissions'
import { deleteRole } from '../actions'

export const metadata = {
  title: 'Role',
}

interface RoleResponse {
  role: Role
  permission_groups: PermissionGroup[]
}

export default async function EditRolePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  if (!can(user, 'roles.view')) {
    redirect('/manage')
  }

  const { id } = await params
  let data: RoleResponse | null = null
  try {
    data = await manageFetch<RoleResponse>('/roles/' + encodeURIComponent(id))
  } catch (error) {
    if (error instanceof ManageApiError && error.status === 404) {
      notFound()
    }
    throw error
  }
  const role = data.role

  let usersText = 'Nobody has this role yet.'
  if (role.users === 1) {
    usersText = '1 user has this role.'
  } else if (role.users > 1) {
    usersText = role.users + ' users have this role.'
  }

  let deleteDescription = 'Removes the role. ' + usersText
  if (role.users > 0) {
    deleteDescription = deleteDescription + ' They lose what this role allowed.'
  }

  return (
    <div className="manage-page">
      <Link href="/manage/roles" className="back-button">
        <ChevronLeft /> Roles
      </Link>
      <header className="manage-page-header">
        <h1>{role.name}</h1>
        <p>{usersText}</p>
      </header>

      <RoleForm key={role.id} role={role} groups={data.permission_groups} actor={user} readOnly={!can(user, 'roles.edit')} />

      {can(user, 'roles.delete') && (
        <section className="manage-panel danger">
          <h2>Delete role</h2>
          <DeleteForm
            id={role.id}
            action={deleteRole}
            buttonText="Delete role"
            description={deleteDescription}
            confirmText={'Delete the role ' + role.name + '? Users with it lose what it allowed.'}
          />
        </section>
      )}
    </div>
  )
}
