import { getIncident, getMaintenance } from '@/lib/api'
import { getSiteConfig } from '@/lib/branding'
import { OG_COLORS, ogCard } from '@/lib/og-card'
import { getPublicStatus } from '@/lib/public-status'
import { formatWindow } from '@/lib/time'

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export async function statusImage() {
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

export async function incidentImage(id: string) {
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

export async function maintenanceImage(id: string) {
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
