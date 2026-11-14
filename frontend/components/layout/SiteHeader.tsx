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

const contactHref = 'https://portfolio.hampternom.nl/#contact'

export default function SiteHeader({ siteName }: { siteName: string }) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(
    function () {
      setMenuOpen(false)
    },
    [pathname]
  )

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
    return ''
  }

  function toggleMenu() {
    setMenuOpen(!menuOpen)
  }

  var menuLabel = 'Open menu'
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
            <a href={contactHref} target="_blank">Contact</a>
          </nav>
          <ThemeSwitcher />
          <div className="dropdown mobile-menu" ref={menuRef}>
            <button
              type="button"
              className="dropdown-trigger"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={menuLabel}
              onClick={toggleMenu}
            >
              {menuOpen && <X size={14} />}
              {!menuOpen && <Menu />}
            </button>
            {menuOpen && (
              <nav className="dropdown-menu" aria-label="Status navigation">
                {links.map(function (link) {
                  return (
                    <Link href={link.href} className={navClass(link.href)} key={link.href}>
                      {link.label}
                    </Link>
                  )
                })}
                <a href={contactHref} target="_blank">Contact</a>
              </nav>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
