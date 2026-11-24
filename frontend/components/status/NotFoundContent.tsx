import Link from 'next/link'
import { Search } from '@/components/icons'

export default function NotFoundContent({ homeHref, homeLabel }: { homeHref: string; homeLabel: string }) {
  return (
    <section className="not-found">
      <span className="not-found-icon">
        <Search />
      </span>
      <span className="not-found-code">404</span>
      <h1>Page not found</h1>
      <p>This page doesn&apos;t exist or has been moved. Check the address, or go back.</p>
      <Link href={homeHref} className="button-primary">
        {homeLabel}
      </Link>
    </section>
  )
}
