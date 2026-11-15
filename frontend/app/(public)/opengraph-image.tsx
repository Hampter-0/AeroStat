import { getSiteConfig } from '@/lib/branding'
import { OG_COLORS, OG_SIZE, ogCard } from '@/lib/og-card'
import { getPublicStatus } from '@/lib/public-status'

export const alt = 'Current status'
export const size = OG_SIZE
export const contentType = 'image/png'

export default async function Image() {
  const config = await getSiteConfig()

  let status = null
  try {
    status = await getPublicStatus()
  } catch {
    status = null
  }

  if (!status) {
    return ogCard({ icon: 'server', color: OG_COLORS.grey, headline: 'Status unavailable', subline: config.siteName, siteName: config.siteName })
  }

  if (status.status === 'outage') {
    let down = 0
    for (const service of status.services) {
      if (service.status === 'offline') {
        down = down + 1
      }
    }
    let headline = 'Some services are down'
    if (down === status.services.length) {
      headline = 'All services are down'
    }
    let subline = down + ' of ' + status.services.length + ' services are not responding'
    if (down === 1) {
      subline = '1 of ' + status.services.length + ' services is not responding'
    }
    return ogCard({ icon: 'cross', color: OG_COLORS.red, headline: headline, subline: subline, siteName: config.siteName })
  }

  if (status.status === 'degraded') {
    let subline = config.siteName
    if (status.ongoing_incidents.length > 0) {
      subline = status.ongoing_incidents[0].title
    }
    return ogCard({ icon: 'alert', color: OG_COLORS.amber, headline: 'Ongoing incident', subline: subline, siteName: config.siteName })
  }

  if (status.status === 'maintenance') {
    let subline = config.siteName
    if (status.maintenance_in_progress.length > 0) {
      subline = status.maintenance_in_progress[0].title
    }
    return ogCard({ icon: 'wrench', color: OG_COLORS.blue, headline: 'Ongoing maintenance', subline: subline, siteName: config.siteName })
  }

  if (status.status === 'no_services') {
    return ogCard({ icon: 'server', color: OG_COLORS.grey, headline: 'No services yet', subline: config.siteName, siteName: config.siteName })
  }

  return ogCard({ icon: 'check', color: OG_COLORS.green, headline: 'All services are online', subline: config.siteName, siteName: config.siteName })
}
