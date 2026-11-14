import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'
import SiteHeader from '@/components/layout/SiteHeader'
import PoweredBy from '@/components/layout/PoweredBy'
import { themeInitScript } from '@/lib/theme'

var siteName: string = 'AeroStat'
if (process.env.SITE_NAME) {
  siteName = process.env.SITE_NAME
}

var accentColor: string = '#1678c2'
if (process.env.PRIMARY_COLOR) {
  accentColor = process.env.PRIMARY_COLOR
}

export const metadata: Metadata = {
  title: siteName,
  description: 'Status page',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const bodyStyle = { '--blue': accentColor } as React.CSSProperties

  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body style={bodyStyle}>
        <SiteHeader siteName={siteName} />
        <main>{children}</main>
        <PoweredBy siteName={siteName} />
      </body>
    </html>
  )
}