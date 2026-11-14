import type { Metadata } from 'next'
import Script from 'next/script'
import type { ReactNode } from 'react'
import './globals.css'
import ThemeSync from '@/components/layout/ThemeSync'
import { accentColor, siteName } from '@/lib/branding'
import { themeInitScript } from '@/lib/theme'

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
        <ThemeSync />
        {children}
      </body>
    </html>
  )
}
