import { redirect } from 'next/navigation'
import NewUserForm from '@/components/manage/NewUserForm'
import UserRow from '@/components/manage/UserRow'
import { manageFetch, requireUser } from '@/lib/manage'

export const metadata = {
  title: 'Users',
}

interface UserRecord {
  id: number
  username: string
  email: string | null
  is_admin: boolean
  permissions: string[]
  created_at: string
}

interface UsersResponse {
  users: UserRecord[]
  available_permissions: string[]
}

export default async function UsersPage() {
  const currentUser = await requireUser()
  if (!currentUser.is_admin) {
    redirect('/manage')
  }

  const data = await manageFetch<UsersResponse>('/users')

  return (
    <div className="manage-page">
      <header className="manage-page-header">
        <h1>Users</h1>
        <p>Admins can do everything. Other users can only manage the parts you tick.</p>
      </header>

      <section className="manage-panel">
        <h2>Add user</h2>
        <NewUserForm permissions={data.available_permissions} />
      </section>

      <section className="manage-panel">
        <h2>All users</h2>
        <div className="user-list">
          {data.users.map(function (user) {
            let isSelf = false
            if (user.id === currentUser.id) {
              isSelf = true
            }
            return (
              <UserRow
                key={user.id + '-' + user.is_admin + '-' + user.permissions.join(',')}
                user={user}
                permissions={data.available_permissions}
                isSelf={isSelf}
              />
            )
          })}
        </div>
      </section>
    </div>
  )
}
