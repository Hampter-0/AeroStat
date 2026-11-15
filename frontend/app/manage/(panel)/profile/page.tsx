import AccountForm from '@/components/manage/profile/AccountForm'
import AvatarForm from '@/components/manage/profile/AvatarForm'
import EmailNotificationsForm from '@/components/manage/profile/EmailNotificationsForm'
import PasswordForm from '@/components/manage/profile/PasswordForm'
import type { MyNotifications } from '@/lib/email'
import { manageFetch, PERMISSION_LABELS, requireUser } from '@/lib/manage'

export const metadata = {
  title: 'Profile',
}

export default async function ProfilePage() {
  const user = await requireUser()
  const notifications = await manageFetch<MyNotifications>('/profile/notifications')

  const access: string[] = []
  if (!user.is_admin) {
    for (const permission of user.permissions) {
      access.push(PERMISSION_LABELS[permission] || permission)
    }
  }

  return (
    <div className="manage-page">
      <header className="manage-page-header">
        <h1>Profile</h1>
        <p>How you sign in and how others see you in the panel.</p>
      </header>

      <section className="manage-panel">
        <h2>Photo</h2>
        <AvatarForm userId={user.id} username={user.username} version={user.avatar_version} />
      </section>

      <section className="manage-panel">
        <h2>Account</h2>
        <AccountForm username={user.username} email={user.email} />
      </section>

      <section className="manage-panel">
        <h2>Password</h2>
        <PasswordForm />
      </section>

      <section className="manage-panel">
        <h2>Email notifications</h2>
        <EmailNotificationsForm settings={notifications} />
      </section>

      <section className="manage-panel">
        <h2>Your access</h2>
        {user.is_admin && (
          <div className="user-row-access">
            <span className="chip admin">Admin</span>
          </div>
        )}
        {!user.is_admin && access.length === 0 && (
          <p className="manage-empty">You don&apos;t have any permissions yet. Ask an admin to give you access.</p>
        )}
        {!user.is_admin && access.length > 0 && (
          <div className="user-row-access">
            {access.map(function (label) {
              return (
                <span className="chip" key={label}>
                  {label}
                </span>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
