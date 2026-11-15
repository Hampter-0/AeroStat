export const TIMEZONE_COOKIE = 'aerostat_tz'

export interface TimezoneChoice {
  mode: 'site' | 'local' | 'custom'
  zone: string
}

export function isValidTimezone(zone: string): boolean {
  if (!zone) {
    return false
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

export function parseTimezoneCookie(value: string | undefined): TimezoneChoice {
  if (!value) {
    return { mode: 'site', zone: '' }
  }
  const decoded = decodeURIComponent(value)
  if (decoded.startsWith('local:')) {
    return { mode: 'local', zone: decoded.slice('local:'.length) }
  }
  if (decoded.startsWith('zone:')) {
    return { mode: 'custom', zone: decoded.slice('zone:'.length) }
  }
  return { mode: 'site', zone: '' }
}

export function timezoneCookieValue(choice: TimezoneChoice): string {
  if (choice.mode === 'local') {
    return 'local:' + choice.zone
  }
  return 'zone:' + choice.zone
}
