import Link from 'next/link'
import { redirect } from 'next/navigation'
import UsersTable from '@/components/manage/users/UsersTable'
import { getSiteConfig } from '@/lib/branding'
import { can, manageFetch, requireUser } from '@/lib/manage'
import type { UsersResponse } from '@/lib/users'
import PageHeader from '@/components/manage/PageHeader'

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
      <PageHeader
        title="Users"
        description="Everyone who can sign in to the panel. What they can do comes from their roles and extra permissions."
        action={
          can(currentUser, 'users.create') && (
            <Link href="/manage/users/new" className="button-primary">
              Create user
            </Link>
          )
        }
      />

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
