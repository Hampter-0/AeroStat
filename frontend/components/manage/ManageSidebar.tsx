'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import Logo from '@/components/layout/Logo'
import Avatar from '@/components/manage/Avatar'
import ThemeSwitcher from '@/components/layout/ThemeSwitcher'
import { Activity, AlertTriangle, ExternalLink, Home, LogOut, Server, Settings, Tool, Users } from '@/components/icons'
import { logout } from '@/app/manage/actions'
import type { ManageUser } from '@/lib/manage'
import type { VersionInfo } from '@/lib/version'

interface NavItem {
  href: string
  label: string
  icon: ReactNode
}

export default function ManageSidebar({
  siteName,
  user,
  version,
}: {
  siteName: string
  user: ManageUser
  version: VersionInfo | null
}) {
  const pathname = usePathname()

  const items: NavItem[] = [{ href: '/manage', label: 'Overview', icon: <Home /> }]
  if (user.is_admin || user.permissions.includes('incidents')) {
    items.push({ href: '/manage/incidents', label: 'Incidents', icon: <AlertTriangle size={16} /> })
  }
  if (user.is_admin || user.permissions.includes('maintenance')) {
    items.push({ href: '/manage/maintenance', label: 'Maintenance', icon: <Tool size={16} /> })
  }
  if (user.is_admin || user.permissions.includes('services')) {
    items.push({ href: '/manage/services', label: 'Services', icon: <Server /> })
  }
  if (user.is_admin || user.permissions.includes('settings')) {
    items.push({ href: '/manage/settings', label: 'Settings', icon: <Settings /> })
  }
  if (user.is_admin) {
    items.push({ href: '/manage/users', label: 'Users', icon: <Users /> })
    items.push({ href: '/manage/activity', label: 'Activity', icon: <Activity /> })
  }

  function linkClass(href: string) {
    if (pathname === href) {
      return 'active'
    }
    if (href !== '/manage' && pathname.startsWith(href + '/')) {
      return 'active'
    }
    return ''
  }

  let roleLabel = 'Editor'
  if (user.is_admin) {
    roleLabel = 'Admin'
  }

  return (
    <aside className="manage-sidebar">
      <Link href="/manage" className="manage-brand">
        <Logo size={24} />
        <span>{siteName}</span>
      </Link>

      <nav className="manage-nav" aria-label="Manage navigation">
        {items.map(function (item) {
          return (
            <Link href={item.href} className={linkClass(item.href)} key={item.href}>
              {item.icon}
              {item.label}
            </Link>
          )
        })}
        <a href="/" target="_blank">
          <ExternalLink />
          Status page
        </a>
      </nav>

      {version && (
        <div className="manage-version">
          <span>AeroStat v{version.current}</span>
          {user.is_admin && version.update_available && version.release_url && (
            <a href={version.release_url} target="_blank" rel="noreferrer" className="version-update" title={'v' + version.latest + ' is available'}>
              Update
            </a>
          )}
        </div>
      )}

      <div className="manage-account">
        <Link href="/manage/profile" className={'manage-account-user ' + linkClass('/manage/profile')} title="Your profile">
          <Avatar userId={user.id} username={user.username} version={user.avatar_version} size={30} />
          <span className="manage-account-text">
            <strong>{user.username}</strong>
            <span>{roleLabel}</span>
          </span>
        </Link>
        <div className="manage-account-actions">
          <ThemeSwitcher />
          <form action={logout}>
            <button type="submit" className="icon-button" aria-label="Sign out" title="Sign out">
              <LogOut />
            </button>
          </form>
        </div>
      </div>
    </aside>
  )
}
