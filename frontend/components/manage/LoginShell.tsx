import Link from 'next/link'
import type { ReactNode } from 'react'
import Logo from '@/components/layout/Logo'
import ToastProvider from '@/components/manage/toast/Toasts'
import { getSiteConfig } from '@/lib/branding'

export default async function LoginShell({ children }: { children: ReactNode }) {
  const config = await getSiteConfig()
  const siteName = config.siteName
  const year = new Date().getUTCFullYear()
  let ownerName = siteName
  if (config.companyName) {
    ownerName = config.companyName
  }
  let owner = <Link href="/">{ownerName}</Link>
  if (config.companyUrl) {
    owner = (
      <a href={config.companyUrl} target="_blank" rel="noopener">
        {ownerName}
      </a>
    )
  }

  return (
    <ToastProvider>
      <div className="manage-login">
        <div className="manage-login-inner">
          <div className="manage-login-brand">
            <Logo size={44} />
            <span>{siteName}</span>
          </div>

          {children}

          <footer className="manage-login-footer">
            <Logo size={14} />
            {owner}
            <span>© {year}</span>
          </footer>
        </div>
      </div>
    </ToastProvider>
  )
}
