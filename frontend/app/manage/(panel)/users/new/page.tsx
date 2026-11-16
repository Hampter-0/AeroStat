import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from '@/components/icons'
import UserForm from '@/components/manage/users/UserForm'
import { can, manageFetch, requireUser } from '@/lib/manage'
import type { UsersResponse } from '@/lib/users'

export const metadata = {
  title: 'Create user',
}

export default async function NewUserPage() {
  const currentUser = await requireUser()
  if (!can(currentUser, 'users.create')) {
    redirect('/manage')
  }

  const data = await manageFetch<UsersResponse>('/users')

  return (
    <div className="manage-page">
      <Link href="/manage/users" className="back-button">
        <ChevronLeft /> Users
      </Link>
      <header className="manage-page-header">
        <h1>Create user</h1>
        <p>They sign in with this username or email address and the password you set.</p>
      </header>
      <UserForm user={null} roles={data.roles} groups={data.permission_groups} actor={currentUser} isSelf={false} />
    </div>
  )
}
