import type { ReactNode } from 'react'
import SiteHeader from '@/components/layout/SiteHeader'
import PoweredBy from '@/components/layout/PoweredBy'
import { contactUrl, siteName } from '@/lib/branding'

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader siteName={siteName} contactUrl={contactUrl} />
      <main>{children}</main>
      <PoweredBy siteName={siteName} />
    </>
  )
}
