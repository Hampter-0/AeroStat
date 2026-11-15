import { formatDateTimeShort } from './time'

export function formatDateTime(iso: string, timezone: string) {
  return formatDateTimeShort(iso, timezone)
}

export function formatStatus(status: string) {
  const text = status.replace('_', ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}
