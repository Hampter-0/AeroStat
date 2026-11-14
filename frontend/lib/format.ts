export function formatDateTime(iso: string) {
  const date = new Date(iso)
  const dateText = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  const timeText = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' })
  return dateText + ', ' + timeText + ' UTC'
}

export function formatStatus(status: string) {
  const text = status.replace('_', ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}
