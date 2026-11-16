import type { ReactNode } from 'react'
import { AtSign, Bell, Key, Lock, LogIn, Shield, Smartphone, User } from '@/components/icons'
import AccountForm from '@/components/manage/profile/AccountForm'
import AvatarForm from '@/components/manage/profile/AvatarForm'
import EmailForm from '@/components/manage/profile/EmailForm'
import EmailNotificationsForm from '@/components/manage/profile/EmailNotificationsForm'
import PasswordForm from '@/components/manage/profile/PasswordForm'
import PasswordLoginForm from '@/components/manage/profile/PasswordLoginForm'
import ProfileTabs from '@/components/manage/profile/ProfileTabs'
import SecurityKeys, { type PasskeyRow } from '@/components/manage/profile/SecurityKeys'
import TwoFactorCard from '@/components/manage/profile/TwoFactorCard'
import { getSiteConfig } from '@/lib/branding'
import type { MyNotifications } from '@/lib/email'
import { manageFetch, requireUser } from '@/lib/manage'
import type { PasskeysResponse } from '@/lib/passkeys'
import { currentTimeMs, formatAgo, formatDateTimeShort } from '@/lib/time'
import type { TwoFactorStatus } from '@/lib/two-factor'

export const metadata = {
  title: 'Profile',
}

function Card({ icon, title, wide, children }: { icon: ReactNode; title: string; wide?: boolean; children: ReactNode }) {
  let className = 'manage-panel profile-card'
  if (wide) {
    className = 'manage-panel profile-card wide'
  }
  return (
    <section className={className}>
      <h2 className="profile-card-head">
        <span className="profile-card-icon">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

export default async function ProfilePage() {
  const user = await requireUser(true)
  const notifications = await manageFetch<MyNotifications>('/profile/notifications')
  const security = await manageFetch<PasskeysResponse>('/profile/passkeys')
  const twoFactor = await manageFetch<TwoFactorStatus>('/profile/two-factor')
  const { timezone } = await getSiteConfig()
  const now = currentTimeMs()

  const passkeys: PasskeyRow[] = []
  for (const passkey of security.passkeys) {
    let usedText = 'never used'
    if (passkey.last_used_at) {
      usedText = 'used ' + formatAgo(now - new Date(passkey.last_used_at).getTime())
    }
    passkeys.push({
      ...passkey,
      addedText: 'Added ' + formatDateTimeShort(passkey.created_at, timezone),
      usedText: usedText,
    })
  }

  return (
    <div className="manage-page">
      <header className="manage-page-header">
        <h1>Profile</h1>
        <p>How you sign in and how others see you in the panel.</p>
      </header>
      <ProfileTabs active="/manage/profile" />

      {user.two_factor_setup_required && (
        <section className="update-notice warning" role="alert">
          <div>
            <strong>Set up two-factor sign-in to continue</strong>
            <span>
              An admin requires it for your account. Turn on the authenticator app or email codes under Two-factor sign-in, or
              add a passkey. Until then you can only use your profile.
            </span>
          </div>
        </section>
      )}

      <div className="profile-grid">
        <Card icon={<User />} title="Account details">
          <AvatarForm userId={user.id} username={user.username} version={user.avatar_version} />
          <AccountForm username={user.username} email={user.email} />
        </Card>

        <Card icon={<AtSign />} title="Email">
          <EmailForm username={user.username} email={user.email} />
        </Card>

        <Card icon={<Lock />} title="Password">
          <PasswordForm />
        </Card>

        <Card icon={<Key />} title="Security keys">
          <SecurityKeys passkeys={passkeys} available={security.available} />
        </Card>

        <Card icon={<Smartphone />} title="Two-factor sign-in">
          <TwoFactorCard status={twoFactor} />
        </Card>

        <Card icon={<LogIn />} title="Password login">
          <PasswordLoginForm enabled={security.password_login} passkeys={security.passkeys.length} />
        </Card>

        <Card icon={<Shield />} title="Your access">
          {user.roles.length === 0 && user.extra_permissions.length === 0 && (
            <p className="manage-empty">You don&apos;t have a role yet. Ask an admin to give you access.</p>
          )}
          {(user.roles.length > 0 || user.extra_permissions.length > 0) && (
            <div className="user-row-access">
              {user.roles.map(function (name) {
                let className = 'chip'
                if (user.super_roles.includes(name)) {
                  className = 'chip admin'
                }
                return (
                  <span className={className} key={name}>
                    {name}
                  </span>
                )
              })}
              {user.extra_permissions.length > 0 && <span className="chip">+{user.extra_permissions.length} extra</span>}
            </div>
          )}
          {user.is_admin && <p className="manage-empty">You are a super user and can do everything in the panel.</p>}
        </Card>

        <Card icon={<Bell />} title="Email notifications" wide={true}>
          <EmailNotificationsForm settings={notifications} />
        </Card>
      </div>
    </div>
  )
}
