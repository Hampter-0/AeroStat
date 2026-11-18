import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft } from '@/components/icons'
import Avatar from '@/components/manage/Avatar'
import DeleteForm from '@/components/manage/DeleteForm'
import UserForm from '@/components/manage/users/UserForm'
import { getSiteConfig } from '@/lib/branding'
import { can, manageFetch, requireUser } from '@/lib/manage'
import { formatDateTimeShort } from '@/lib/time'
import type { UsersResponse } from '@/lib/users'
import { deleteUser } from '../actions'
import { resetTwoFactor } from '../two-factor-actions'

export const metadata = {
  title: 'User',
}

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const currentUser = await requireUser()
  if (!can(currentUser, 'users.view')) {
    redirect('/manage')
  }

  const { id } = await params
  const data = await manageFetch<UsersResponse>('/users')
  const { timezone } = await getSiteConfig()

  let user = null
  for (const candidate of data.users) {
    if (String(candidate.id) === id) {
      user = candidate
    }
  }
  if (!user) {
    notFound()
  }
  const isSelf = user.id === currentUser.id

  let lockReason = ''
  if (!isSelf && user.owner) {
    lockReason = 'This is the owner’s account. Only the owner can change it, on their own profile.'
  } else if (!isSelf && user.is_admin && !currentUser.owner) {
    lockReason = 'Only the owner can change or delete another admin.'
  }
  const canEdit = can(currentUser, 'users.edit') && lockReason === ''
  const canDelete = can(currentUser, 'users.delete') && lockReason === ''

  let lastLogin = 'never signed in'
  if (user.last_login_at) {
    lastLogin = 'last signed in ' + formatDateTimeShort(user.last_login_at, timezone)
  }

  let superText = 'No'
  if (user.is_admin) {
    superText = 'Yes'
  }
  let suspendedText = 'No'
  if (user.suspended) {
    suspendedText = 'Yes'
  }
  const roleNames: string[] = []
  for (const role of data.roles) {
    if (user.role_ids.includes(role.id)) {
      roleNames.push(role.name)
    }
  }
  const extraLabels: string[] = []
  for (const group of data.permission_groups) {
    for (const permission of group.permissions) {
      if (user.permissions.includes(permission.key)) {
        extraLabels.push(group.label + ': ' + permission.label)
      }
    }
  }

  return (
    <div className="manage-page">
      <Link href="/manage/users" className="back-button">
        <ChevronLeft /> Users
      </Link>
      <header className="manage-page-header user-header">
        <Avatar userId={user.id} username={user.username} version={user.avatar_version} size={44} />
        <div>
          <h1>{user.username}</h1>
          <p>
            Member since {formatDateTimeShort(user.created_at, timezone)}, {lastLogin}.
          </p>
        </div>
      </header>

      {canEdit && (
        <UserForm user={user} roles={data.roles} groups={data.permission_groups} actor={currentUser} isSelf={isSelf} />
      )}

      {!canEdit && (
        <section className="manage-panel">
          {lockReason && <p className="panel-intro">{lockReason}</p>}
          <dl className="config-list">
            <div className="config-row">
              <dt>Email</dt>
              <dd>{user.email || 'Not set'}</dd>
            </div>
            <div className="config-row">
              <dt>Admin</dt>
              <dd>{superText}</dd>
            </div>
            <div className="config-row">
              <dt>Suspended</dt>
              <dd>{suspendedText}</dd>
            </div>
            <div className="config-row">
              <dt>Roles</dt>
              <dd>{roleNames.join(', ') || 'No roles'}</dd>
            </div>
            <div className="config-row">
              <dt>Extra permissions</dt>
              <dd>{extraLabels.join(', ') || 'None'}</dd>
            </div>
          </dl>
        </section>
      )}

      {!isSelf && user.two_factor && canEdit && (
        <section className="manage-panel danger">
          <h2>Reset two-factor</h2>
          <DeleteForm
            id={user.id}
            action={resetTwoFactor}
            buttonText="Reset two-factor"
            description="Turns off their authenticator app and email codes and removes their recovery codes. Use this when they lost their phone. Their passkeys stay."
            confirmText={'Reset two-factor sign-in for ' + user.username + '?'}
          />
        </section>
      )}

      {!isSelf && canDelete && (
        <section className="manage-panel danger">
          <h2>Delete user</h2>
          <DeleteForm
            id={user.id}
            action={deleteUser}
            buttonText="Delete user"
            description="Removes the account. They are signed out right away. Their activity stays in the log."
            confirmText={'Delete ' + user.username + '? They will be signed out immediately.'}
          />
        </section>
      )}
    </div>
  )
}
