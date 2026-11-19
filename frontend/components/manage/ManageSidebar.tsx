'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import Logo from '@/components/layout/Logo'
import Avatar from '@/components/manage/Avatar'
import ThemeSwitcher from '@/components/layout/ThemeSwitcher'
import {
  Activity,
  AlertTriangle,
  Chevron,
  ExternalLink,
  Gauge,
  HelpCircle,
  Home,
  LogOut,
  Menu,
  Server,
  Settings,
  Shield,
  Tool,
  User,
  Users,
  X,
} from '@/components/icons'
import { logout } from '@/app/manage/actions'
import type { ManageUser } from '@/lib/manage'
import { hasPermission } from '@/lib/permissions'
import type { VersionInfo } from '@/lib/version'

interface NavItem {
  href: string
  label: string
  icon: ReactNode
}

interface NavGroup {
  key: string
  label: string
  items: NavItem[]
}

function buildGroups(user: ManageUser): NavGroup[] {
  const status: NavItem[] = []
  if (hasPermission(user, 'incidents.view')) {
    status.push({ href: '/manage/incidents', label: 'Incidents', icon: <AlertTriangle size={18} /> })
  }
  if (hasPermission(user, 'maintenance.view')) {
    status.push({ href: '/manage/maintenance', label: 'Maintenance', icon: <Tool size={18} /> })
  }
  if (hasPermission(user, 'services.view')) {
    status.push({ href: '/manage/services', label: 'Services', icon: <Server size={18} /> })
  }

  const people: NavItem[] = []
  if (hasPermission(user, 'users.view')) {
    people.push({ href: '/manage/users', label: 'Users', icon: <Users /> })
  }
  if (hasPermission(user, 'roles.view')) {
    people.push({ href: '/manage/roles', label: 'Roles', icon: <Shield /> })
  }
  if (hasPermission(user, 'activity.view')) {
    people.push({ href: '/manage/activity', label: 'Activity', icon: <Activity /> })
  }

  const system: NavItem[] = []
  const settingsPermissions = ['settings.general', 'settings.appearance', 'settings.monitoring', 'settings.time', 'settings.notifications']
  const canSettings = settingsPermissions.some(function (permission) {
    return hasPermission(user, permission)
  })
  if (canSettings) {
    system.push({ href: '/manage/settings', label: 'Settings', icon: <Settings /> })
  }
  if (hasPermission(user, 'system.view')) {
    system.push({ href: '/manage/system', label: 'System', icon: <Gauge /> })
  }
  system.push({ href: '/manage/help', label: 'Help', icon: <HelpCircle /> })

  const groups: NavGroup[] = [{ key: 'main', label: '', items: [{ href: '/manage', label: 'Overview', icon: <Home /> }] }]
  if (status.length > 0) {
    groups.push({ key: 'status', label: 'Status page', items: status })
  }
  if (people.length > 0) {
    groups.push({ key: 'people', label: 'People', items: people })
  }
  groups.push({ key: 'system', label: 'System', items: system })
  return groups
}

function AccountMenu({ user }: { user: ManageUser }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(
    function () {
      if (!open) {
        return
      }
      function onPointerDown(event: PointerEvent) {
        if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
          setOpen(false)
        }
      }
      function onKeyDown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
          setOpen(false)
        }
      }
      document.addEventListener('pointerdown', onPointerDown)
      document.addEventListener('keydown', onKeyDown)
      return function () {
        document.removeEventListener('pointerdown', onPointerDown)
        document.removeEventListener('keydown', onKeyDown)
      }
    },
    [open]
  )

  function toggleOpen() {
    setOpen(!open)
  }

  function close() {
    setOpen(false)
  }

  let roleLabel = 'No role'
  if (user.roles.length > 0) {
    roleLabel = user.roles.join(', ')
  }

  return (
    <div className="dropdown account-menu" ref={rootRef}>
      <button type="button" className="account-trigger" aria-haspopup="menu" aria-expanded={open} aria-label="Your account" onClick={toggleOpen}>
        <Avatar userId={user.id} username={user.username} version={user.avatar_version} size={36} />
      </button>
      {open && (
        <div className="dropdown-menu account-dropdown" role="menu">
          <div className="account-dropdown-head">
            <strong>{user.username}</strong>
            <span>{roleLabel}</span>
          </div>
          <Link href="/manage/profile" role="menuitem" onClick={close}>
            <User />
            Profile
          </Link>
          <form action={logout}>
            <button type="submit" role="menuitem">
              <LogOut />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  )
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
  const [menuOpen, setMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<string[]>([])
  const groups = buildGroups(user)

  function linkClass(href: string) {
    if (pathname === href) {
      return 'active'
    }
    if (href !== '/manage' && pathname.startsWith(href + '/')) {
      return 'active'
    }
    return ''
  }

  function toggleMenu() {
    setMenuOpen(!menuOpen)
  }

  function closeMenu() {
    setMenuOpen(false)
  }

  function toggleGroup(key: string) {
    if (collapsed.includes(key)) {
      setCollapsed(
        collapsed.filter(function (item) {
          return item !== key
        })
      )
    } else {
      setCollapsed(collapsed.concat(key))
    }
  }

  let sidebarClass = 'manage-sidebar'
  if (menuOpen) {
    sidebarClass = 'manage-sidebar open'
  }

  let menuIcon = <Menu />
  if (menuOpen) {
    menuIcon = <X size={18} />
  }

  return (
    <>
      <header className="manage-topbar">
        <button type="button" className="topbar-menu" aria-label="Menu" aria-expanded={menuOpen} onClick={toggleMenu}>
          {menuIcon}
        </button>
        <Link href="/manage" className="manage-brand" onClick={closeMenu}>
          <Logo size={28} />
          <span>{siteName}</span>
        </Link>
        <div className="topbar-actions">
          <a href="/" target="_blank" className="topbar-link">
            <ExternalLink />
            <span>Status page</span>
          </a>
          <ThemeSwitcher />
          <AccountMenu user={user} />
        </div>
      </header>

      {menuOpen && <div className="manage-scrim" onClick={closeMenu} />}

      <aside className={sidebarClass}>
        <nav className="manage-nav" aria-label="Manage navigation">
          {groups.map(function (group) {
            const isCollapsed = collapsed.includes(group.key)
            return (
              <div className="nav-group" key={group.key}>
                {group.label && (
                  <button
                    type="button"
                    className="nav-group-toggle"
                    aria-expanded={!isCollapsed}
                    onClick={function () {
                      toggleGroup(group.key)
                    }}
                  >
                    {group.label}
                    <Chevron open={!isCollapsed} />
                  </button>
                )}
                {!isCollapsed &&
                  group.items.map(function (item) {
                    return (
                      <Link href={item.href} className={linkClass(item.href)} key={item.href} onClick={closeMenu}>
                        {item.icon}
                        {item.label}
                      </Link>
                    )
                  })}
              </div>
            )
          })}
        </nav>

        {version && (
          <div className="manage-version">
            <span>AeroStat v{version.current}</span>
            {hasPermission(user, 'system.view') && version.update_available && (
              <Link href="/manage/system?tab=updates" className="version-update" title={'v' + version.latest + ' is available'} onClick={closeMenu}>
                Update available
              </Link>
            )}
          </div>
        )}
      </aside>
    </>
  )
}
