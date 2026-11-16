import Link from 'next/link'
import { redirect } from 'next/navigation'
import UsersTable from '@/components/manage/users/UsersTable'
import { getSiteConfig } from '@/lib/branding'
import { can, manageFetch, requireUser } from '@/lib/manage'
import type { UsersResponse } from '@/lib/users'

export const metadata = {
  title: 'Users',
}

export default async function UsersPage() {
  const currentUser = await requireUser()
  if (!can(currentUser, 'users.view')) {
    redirect('/manage')
  }

  const data = await manageFetch<UsersResponse>('/users')
  const { timezone } = await getSiteConfig()

  return (
    <div className="manage-page">
      <header className="manage-page-header with-action">
        <div>
          <h1>Users</h1>
          <p>Everyone who can sign in to the panel. What they can do comes from their roles and extra permissions.</p>
        </div>
        {can(currentUser, 'users.create') && (
          <Link href="/manage/users/new" className="button-primary">
            Create user
          </Link>
        )}
      </header>

      <section className="manage-panel activity-panel">
        <UsersTable
          users={data.users}
          roles={data.roles}
          currentUserId={currentUser.id}
          timezone={timezone}
          canEdit={can(currentUser, 'users.edit')}
        />
      </section>
    </div>
  )
}
