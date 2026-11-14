'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import Logo from '@/components/layout/Logo'
import ThemeSwitcher from '@/components/layout/ThemeSwitcher'
import { AlertTriangle, ExternalLink, Home, LogOut, Users } from '@/components/icons'
import { logout } from '@/app/manage/actions'
import type { ManageUser } from '@/lib/manage'

interface NavItem {
  href: string
  label: string
  icon: ReactNode
}

export default function ManageSidebar({ siteName, user }: { siteName: string; user: ManageUser }) {
  const pathname = usePathname()

  const items: NavItem[] = [{ href: '/manage', label: 'Overview', icon: <Home /> }]
  if (user.is_admin || user.permissions.includes('incidents')) {
    items.push({ href: '/manage/incidents', label: 'Incidents', icon: <AlertTriangle size={16} /> })
  }
  if (user.is_admin) {
    items.push({ href: '/manage/users', label: 'Users', icon: <Users /> })
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

      <div className="manage-account">
        <div className="manage-account-user">
          <strong>{user.username}</strong>
          <span>{roleLabel}</span>
        </div>
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
