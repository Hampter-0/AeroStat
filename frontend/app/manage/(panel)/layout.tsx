import type { ReactNode } from 'react'
import ManageSidebar from '@/components/manage/ManageSidebar'
import PanelNotices from '@/components/manage/PanelNotices'
import ConfirmProvider from '@/components/manage/confirm/Confirm'
import ToastProvider from '@/components/manage/toast/Toasts'
import { getSiteConfig } from '@/lib/branding'
import { requireUser } from '@/lib/manage'
import { getVersionInfo } from '@/lib/version'

export const metadata = {
  title: 'Manage',
}

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const user = await requireUser(true)
  const config = await getSiteConfig()
  const version = await getVersionInfo()
  let showNotices = true
  if (user.panel_enabled === false) {
    showNotices = false
  }

  return (
    <ToastProvider>
      <ConfirmProvider>
        <div className="manage-shell">
          <ManageSidebar siteName={config.siteName} user={user} version={version} />
          <div className="manage-content">{children}</div>
        </div>
        {showNotices && <PanelNotices />}
      </ConfirmProvider>
    </ToastProvider>
  )
}
