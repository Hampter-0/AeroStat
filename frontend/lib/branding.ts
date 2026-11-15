import { cache } from 'react'

export interface SiteConfig {
  siteName: string
  description: string
  contactUrl: string | null
  accentColor: string
  timezone: string
  faviconUrl: string | null
}

interface PublicSettings {
  site_name: string | null
  site_description: string | null
  contact_url: string | null
  primary_color: string | null
  timezone: string
  logo_version: number | null
  favicon_version: number | null
}

export function defaultDescription(siteName: string): string {
  return 'Live status, incidents and planned maintenance for ' + siteName + '.'
}

export function envDefaults(): SiteConfig {
  let siteName = 'AeroStat'
  if (process.env.SITE_NAME) {
    siteName = process.env.SITE_NAME
  }
  let accentColor = '#1678c2'
  if (process.env.PRIMARY_COLOR) {
    accentColor = process.env.PRIMARY_COLOR
  }
  let contactUrl: string | null = null
  if (process.env.CONTACT_URL) {
    contactUrl = process.env.CONTACT_URL
  }
  return { siteName, description: defaultDescription(siteName), contactUrl, accentColor, timezone: 'UTC', faviconUrl: null }
}

export const getSiteConfig = cache(async function (): Promise<SiteConfig> {
  const config = envDefaults()
  let settings: PublicSettings
  try {
    const res = await fetch(process.env.API_URL + '/api/settings', { cache: 'no-store' })
    if (!res.ok) {
      return config
    }
    settings = await res.json()
  } catch {
    return config
  }

  if (settings.site_name) {
    config.siteName = settings.site_name
    config.description = defaultDescription(settings.site_name)
  }
  if (settings.site_description) {
    config.description = settings.site_description
  }
  if (settings.contact_url) {
    config.contactUrl = settings.contact_url
  }
  if (settings.primary_color) {
    config.accentColor = settings.primary_color
  }
  if (settings.timezone) {
    config.timezone = settings.timezone
  }
  if (settings.favicon_version) {
    config.faviconUrl = '/branding/favicon?v=' + settings.favicon_version
  }
  return config
})
