import { getMaintenance } from '@/lib/api'
import { getSiteConfig } from '@/lib/branding'
import { OG_COLORS, OG_SIZE, ogCard } from '@/lib/og-card'
import { formatWindow } from '@/lib/time'

export const alt = 'Maintenance'
export const size = OG_SIZE
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const config = await getSiteConfig()

  let maintenance = null
  try {
    maintenance = await getMaintenance(id)
  } catch {
    maintenance = null
  }
  if (!maintenance) {
    return ogCard({ icon: 'wrench', color: OG_COLORS.grey, headline: 'Maintenance not found', subline: config.siteName, siteName: config.siteName })
  }

  const when = formatWindow(maintenance.scheduled_start, maintenance.scheduled_end, config.timezone)
  let label = 'Scheduled maintenance'
  let color = OG_COLORS.blue
  let icon: 'wrench' | 'check' = 'wrench'
  if (maintenance.status === 'in_progress') {
    label = 'Ongoing maintenance'
  } else if (maintenance.status === 'completed') {
    label = 'Completed maintenance'
    color = OG_COLORS.green
    icon = 'check'
  } else if (maintenance.status === 'cancelled') {
    label = 'Cancelled maintenance'
    color = OG_COLORS.grey
  }

  return ogCard({ icon: icon, color: color, headline: maintenance.title, subline: label + ' · ' + when, siteName: config.siteName })
}
