import type { ReactNode } from 'react'
import ManageSidebar from '@/components/manage/ManageSidebar'
import { getSiteConfig } from '@/lib/branding'
import { requireUser } from '@/lib/manage'

export const metadata = {
  title: 'Manage',
}

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const user = await requireUser()
  const config = await getSiteConfig()

  return (
    <div className="manage-shell">
      <ManageSidebar siteName={config.siteName} user={user} />
      <div className="manage-content">{children}</div>
    </div>
  )
}
