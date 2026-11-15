import type { ReactNode } from 'react'
import ManageSidebar from '@/components/manage/ManageSidebar'
import { getSiteConfig } from '@/lib/branding'
import { requireUser } from '@/lib/manage'
import { getVersionInfo } from '@/lib/version'

export const metadata = {
  title: 'Manage',
}

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const user = await requireUser()
  const config = await getSiteConfig()
  const version = await getVersionInfo()

  return (
    <div className="manage-shell">
      <ManageSidebar siteName={config.siteName} user={user} version={version} />
      <div className="manage-content">{children}</div>
    </div>
  )
}
