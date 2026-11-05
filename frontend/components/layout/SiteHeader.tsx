'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Logo from './Logo'

export default function SiteHeader({ siteName }: { siteName: string }) {
  const pathname = usePathname()

  function navClass(path: string) {
    if (pathname === path) {
      return 'active'
    }
    return ''
  }

  return (
    <header className="status-nav">
      <div className="status-nav-inner">
        <Link href="/" className="status-nav-brand">
          <Logo />
          <span>{siteName}</span>
        </Link>
        <nav className="status-nav-right" aria-label="Status navigation">
          <Link href="/" className={navClass('/')}>Status</Link>
          <Link href="/incidents" className={navClass('/incidents')}>Incidents</Link>
          <Link href="/maintenance" className={navClass('/maintenance')}>Maintenance</Link>
          <a href="https://portfolio.hampternom.nl/contact">Contact</a>
        </nav>
      </div>
    </header>
  )
}