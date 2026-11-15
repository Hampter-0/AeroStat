import { cache } from 'react'
import { cookies } from 'next/headers'
import { getSiteConfig } from './branding'
import { TIMEZONE_COOKIE, isValidTimezone, parseTimezoneCookie, type TimezoneChoice } from './timezone-choice'

export interface DisplayTime {
  timezone: string
  siteTimezone: string
  choice: TimezoneChoice
}

export const getDisplayTime = cache(async function (): Promise<DisplayTime> {
  const { timezone: siteTimezone } = await getSiteConfig()
  const store = await cookies()
  const parsed = parseTimezoneCookie(store.get(TIMEZONE_COOKIE)?.value)

  if (parsed.mode === 'site' || !isValidTimezone(parsed.zone)) {
    return { timezone: siteTimezone, siteTimezone, choice: { mode: 'site', zone: siteTimezone } }
  }
  return { timezone: parsed.zone, siteTimezone, choice: parsed }
})
