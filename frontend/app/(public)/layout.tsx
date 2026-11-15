import type { ReactNode } from 'react'
import SiteHeader from '@/components/layout/SiteHeader'
import PoweredBy from '@/components/layout/PoweredBy'
import TimezonePicker from '@/components/layout/TimezonePicker'
import { getSiteConfig } from '@/lib/branding'
import { zoneAbbreviation } from '@/lib/time'
import { getDisplayTime } from '@/lib/visitor-time'

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const config = await getSiteConfig()
  const display = await getDisplayTime()

  const zoneName = display.timezone.replaceAll('_', ' ')
  const abbreviation = zoneAbbreviation(display.timezone)
  let label = abbreviation + ' (' + zoneName + ')'
  if (abbreviation === zoneName) {
    label = zoneName
  }
  const zones = Intl.supportedValuesOf('timeZone')

  return (
    <>
      <SiteHeader siteName={config.siteName} contactUrl={config.contactUrl} />
      <main>{children}</main>
      <footer className="public-footer">
        <TimezonePicker label={label} siteTimezone={display.siteTimezone} choice={display.choice} zones={zones} />
        <PoweredBy siteName={config.siteName} />
      </footer>
    </>
  )
}
