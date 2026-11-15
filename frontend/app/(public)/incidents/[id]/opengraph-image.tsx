import { getIncident } from '@/lib/api'
import { getSiteConfig } from '@/lib/branding'
import { OG_COLORS, OG_SIZE, ogCard } from '@/lib/og-card'

export const alt = 'Incident'
export const size = OG_SIZE
export const contentType = 'image/png'

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const config = await getSiteConfig()

  let incident = null
  try {
    incident = await getIncident(id)
  } catch {
    incident = null
  }
  if (!incident) {
    return ogCard({ icon: 'alert', color: OG_COLORS.grey, headline: 'Incident not found', subline: config.siteName, siteName: config.siteName })
  }

  if (incident.status === 'resolved') {
    return ogCard({ icon: 'check', color: OG_COLORS.green, headline: incident.title, subline: 'Incident · Resolved', siteName: config.siteName })
  }
  return ogCard({
    icon: 'alert',
    color: OG_COLORS.amber,
    headline: incident.title,
    subline: 'Ongoing incident · ' + capitalize(incident.status),
    siteName: config.siteName,
  })
}
