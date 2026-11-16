'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import Logo from '@/components/layout/Logo'
import Avatar from '@/components/manage/Avatar'
import ThemeSwitcher from '@/components/layout/ThemeSwitcher'
import { Activity, AlertTriangle, ExternalLink, Gauge, HelpCircle, Home, LogOut, Server, Settings, Shield, Tool, Users } from '@/components/icons'
import { logout } from '@/app/manage/actions'
import type { ManageUser } from '@/lib/manage'
import { hasPermission } from '@/lib/permissions'
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
  if (hasPermission(user, 'incidents.view')) {
    items.push({ href: '/manage/incidents', label: 'Incidents', icon: <AlertTriangle size={16} /> })
  }
  if (hasPermission(user, 'maintenance.view')) {
    items.push({ href: '/manage/maintenance', label: 'Maintenance', icon: <Tool size={16} /> })
  }
  if (hasPermission(user, 'services.view')) {
    items.push({ href: '/manage/services', label: 'Services', icon: <Server /> })
  }
  const settingsPermissions = ['settings.general', 'settings.appearance', 'settings.monitoring', 'settings.time', 'settings.notifications']
  const canSettings = settingsPermissions.some(function (permission) {
    return hasPermission(user, permission)
  })
  if (canSettings) {
    items.push({ href: '/manage/settings', label: 'Settings', icon: <Settings /> })
  }
  if (hasPermission(user, 'users.view')) {
    items.push({ href: '/manage/users', label: 'Users', icon: <Users /> })
  }
  if (hasPermission(user, 'roles.view')) {
    items.push({ href: '/manage/roles', label: 'Roles', icon: <Shield /> })
  }
  if (hasPermission(user, 'activity.view')) {
    items.push({ href: '/manage/activity', label: 'Activity', icon: <Activity /> })
  }
  if (hasPermission(user, 'system.view')) {
    items.push({ href: '/manage/system', label: 'System', icon: <Gauge /> })
  }
  items.push({ href: '/manage/help', label: 'Help', icon: <HelpCircle /> })

  function linkClass(href: string) {
    if (pathname === href) {
      return 'active'
    }
    if (href !== '/manage' && pathname.startsWith(href + '/')) {
      return 'active'
    }
    return ''
  }

  let roleLabel = 'No role'
  if (user.roles.length > 0) {
    roleLabel = user.roles.join(', ')
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
          {hasPermission(user, 'system.view') && version.update_available && (
            <Link href="/manage/system?tab=updates" className="version-update" title={'v' + version.latest + ' is available'}>
              Update available
            </Link>
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
