'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Menu, X } from '@/components/icons'
import Logo from './Logo'
import ThemeSwitcher from './ThemeSwitcher'

const links = [
  { href: '/', label: 'Status' },
  { href: '/incidents', label: 'Incidents' },
  { href: '/maintenance', label: 'Maintenance' },
]

export default function SiteHeader({ siteName, contactUrl }: { siteName: string; contactUrl: string | null }) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(
    function () {
      if (!menuOpen) {
        return
      }
      function onPointerDown(event: PointerEvent) {
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
          setMenuOpen(false)
        }
      }
      function onKeyDown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
          setMenuOpen(false)
        }
      }
      document.addEventListener('pointerdown', onPointerDown)
      document.addEventListener('keydown', onKeyDown)
      return function () {
        document.removeEventListener('pointerdown', onPointerDown)
        document.removeEventListener('keydown', onKeyDown)
      }
    },
    [menuOpen]
  )

  function navClass(path: string) {
    if (pathname === path) {
      return 'active'
    }
    if (path !== '/' && pathname.startsWith(path + '/')) {
      return 'active'
    }
    if (path === '/incidents' && pathname === '/uptime') {
      return 'active'
    }
    return ''
  }

  function closeMenu() {
    setMenuOpen(false)
  }

  let menuIcon = <Menu />
  if (menuOpen) {
    menuIcon = <X size={18} />
  }

  function toggleMenu() {
    setMenuOpen(!menuOpen)
  }

  let menuLabel = 'Open menu'
  if (menuOpen) {
    menuLabel = 'Close menu'
  }

  return (
    <header className="status-nav">
      <div className="status-nav-inner">
        <Link href="/" className="status-nav-brand">
          <Logo />
          <span>{siteName}</span>
        </Link>
        <div className="status-nav-actions">
          <nav className="status-nav-right" aria-label="Status navigation">
            {links.map(function (link) {
              return (
                <Link href={link.href} className={navClass(link.href)} key={link.href}>
                  {link.label}
                </Link>
              )
            })}
            {contactUrl && <a href={contactUrl} target="_blank">Contact</a>}
          </nav>
          <div className="dropdown mobile-menu" ref={menuRef}>
            <button
              type="button"
              className="dropdown-trigger"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={menuLabel}
              onClick={toggleMenu}
            >
              {menuIcon}
            </button>
            {menuOpen && (
              <nav className="dropdown-menu" aria-label="Status navigation">
                {links.map(function (link) {
                  return (
                    <Link href={link.href} className={navClass(link.href)} key={link.href} onClick={closeMenu}>
                      {link.label}
                    </Link>
                  )
                })}
                {contactUrl && <a href={contactUrl} target="_blank">Contact</a>}
              </nav>
            )}
          </div>
          <ThemeSwitcher />
        </div>
      </div>
    </header>
  )
}
