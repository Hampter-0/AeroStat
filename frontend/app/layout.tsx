import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'
import ThemeSync from '@/components/layout/ThemeSync'
import { getSiteConfig } from '@/lib/branding'
import { themeInitScript } from '@/lib/theme'

export async function generateMetadata(): Promise<Metadata> {
  const config = await getSiteConfig()
  const metadata: Metadata = {
    title: { default: config.siteName, template: '%s · ' + config.siteName },
    description: 'Status page',
  }
  let favicon = '/brand/logo.svg'
  if (config.faviconUrl) {
    favicon = config.faviconUrl
  }
  metadata.icons = { icon: favicon }
  return metadata
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const config = await getSiteConfig()
  const bodyStyle = { '--blue': config.accentColor } as React.CSSProperties

  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script id="theme-init" dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body style={bodyStyle}>
        <ThemeSync />
        {children}
      </body>
    </html>
  )
}
