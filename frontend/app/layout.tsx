import type { Metadata } from 'next'
import Script from 'next/script'
import type { ReactNode } from 'react'
import './globals.css'
import SiteHeader from '@/components/layout/SiteHeader'
import PoweredBy from '@/components/layout/PoweredBy'
import { themeInitScript } from '@/lib/theme'

let siteName: string = 'AeroStat'
if (process.env.SITE_NAME) {
  siteName = process.env.SITE_NAME
}

let accentColor: string = '#1678c2'
if (process.env.PRIMARY_COLOR) {
  accentColor = process.env.PRIMARY_COLOR
}

let contactUrl: string | null = null
if (process.env.CONTACT_URL) {
  contactUrl = process.env.CONTACT_URL
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
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
      </head>
      <body style={bodyStyle}>
        <SiteHeader siteName={siteName} contactUrl={contactUrl} />
        <main>{children}</main>
        <PoweredBy siteName={siteName} />
      </body>
    </html>
  )
}