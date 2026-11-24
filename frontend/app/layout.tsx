import type { Metadata } from 'next'
import { headers } from 'next/headers'
import type { ReactNode } from 'react'
import './globals.css'
import ThemeSync from '@/components/layout/ThemeSync'
import { getSiteConfig } from '@/lib/branding'
import { themeInitScript } from '@/lib/theme'

async function publicBaseUrl(): Promise<URL> {
  const headerStore = await headers()
  let host = headerStore.get('x-forwarded-host')
  if (!host) {
    host = headerStore.get('host')
  }
  if (!host) {
    host = 'localhost:3000'
  }
  let protocol = headerStore.get('x-forwarded-proto')
  if (!protocol) {
    protocol = 'http'
  }
  return new URL(protocol.split(',')[0].trim() + '://' + host.split(',')[0].trim())
}

export async function generateMetadata(): Promise<Metadata> {
  const config = await getSiteConfig()
  const metadata: Metadata = {
    metadataBase: await publicBaseUrl(),
    title: { default: config.siteName, template: '%s - ' + config.siteName },
    description: config.description,
    openGraph: {
      type: 'website',
      siteName: config.siteName,
      title: config.siteName,
      description: config.description,
    },
    twitter: { card: 'summary_large_image' },
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
