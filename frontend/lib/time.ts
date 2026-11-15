function parts(date: Date, timezone: string): Record<string, string> {
  const values: Record<string, string> = {}
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  for (const part of formatter.formatToParts(date)) {
    values[part.type] = part.value
  }
  return values
}

function offsetMs(date: Date, timezone: string): number {
  const p = parts(date, timezone)
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second))
  return asUtc - Math.floor(date.getTime() / 1000) * 1000
}

function shortZoneName(date: Date, timezone: string, locale: string): string {
  const formatter = new Intl.DateTimeFormat(locale, { timeZone: timezone, timeZoneName: 'short' })
  for (const part of formatter.formatToParts(date)) {
    if (part.type === 'timeZoneName') {
      return part.value
    }
  }
  return ''
}

export function zoneAbbreviation(timezone: string, iso?: string): string {
  let date = new Date()
  if (iso) {
    date = new Date(iso)
  }
  if (timezone === 'UTC' || timezone === 'Etc/UTC') {
    return 'UTC'
  }
  const european = shortZoneName(date, timezone, 'en-GB')
  if (european && !european.startsWith('GMT+') && !european.startsWith('GMT-')) {
    return european
  }
  const american = shortZoneName(date, timezone, 'en-US')
  if (american && !american.startsWith('GMT+') && !american.startsWith('GMT-')) {
    return american
  }
  if (european) {
    return european
  }
  return timezone
}

export function formatDayLong(iso: string, timezone: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: timezone })
}

export function formatMonthYear(iso: string, timezone: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: timezone })
}

export function formatTime(iso: string, timezone: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone })
}

export function formatDateTimeLong(iso: string, timezone: string): string {
  return formatDayLong(iso, timezone) + ' at ' + formatTime(iso, timezone) + ' ' + zoneAbbreviation(timezone, iso)
}

export function formatDateTimeShort(iso: string, timezone: string): string {
  const day = new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: timezone })
  return day + ', ' + formatTime(iso, timezone) + ' ' + zoneAbbreviation(timezone, iso)
}

export function formatTimeRange(startIso: string, endIso: string, timezone: string): string {
  return formatTime(startIso, timezone) + '-' + formatTime(endIso, timezone) + ' ' + zoneAbbreviation(timezone, startIso)
}

export function formatWindow(startIso: string, endIso: string, timezone: string): string {
  const startDay = formatDayLong(startIso, timezone)
  const endDay = formatDayLong(endIso, timezone)
  if (startDay === endDay) {
    return startDay + ', ' + formatTimeRange(startIso, endIso, timezone)
  }
  const startZone = zoneAbbreviation(timezone, startIso)
  const endZone = zoneAbbreviation(timezone, endIso)
  let startText = startDay + ', ' + formatTime(startIso, timezone)
  if (startZone !== endZone) {
    startText = startText + ' ' + startZone
  }
  return startText + ' – ' + endDay + ', ' + formatTime(endIso, timezone) + ' ' + endZone
}

export function yearMonth(iso: string, timezone: string): { year: number; month: number } {
  const p = parts(new Date(iso), timezone)
  return { year: Number(p.year), month: Number(p.month) }
}

export function toInputValue(iso: string, timezone: string): string {
  const p = parts(new Date(iso), timezone)
  return p.year + '-' + p.month + '-' + p.day + 'T' + p.hour + ':' + p.minute
}

export function inputValueToIso(value: string, timezone: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!match) {
    return ''
  }
  const guess = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]))
  const first = guess - offsetMs(new Date(guess), timezone)
  const second = guess - offsetMs(new Date(first), timezone)
  return new Date(second).toISOString()
}

export function formatDuration(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60000))
  if (minutes < 1) {
    return 'less than a minute'
  }
  if (minutes < 60) {
    return minutes + 'm'
  }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    const rest = minutes % 60
    if (rest === 0) {
      return hours + 'h'
    }
    return hours + 'h ' + rest + 'm'
  }
  const days = Math.floor(hours / 24)
  const restHours = hours % 24
  if (restHours === 0) {
    return days + 'd'
  }
  return days + 'd ' + restHours + 'h'
}

export function formatAgo(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  if (seconds < 5) {
    return 'just now'
  }
  if (seconds < 60) {
    return seconds + ' seconds ago'
  }
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    if (minutes === 1) {
      return '1 minute ago'
    }
    return minutes + ' minutes ago'
  }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    if (hours === 1) {
      return '1 hour ago'
    }
    return hours + ' hours ago'
  }
  const days = Math.floor(hours / 24)
  if (days === 1) {
    return '1 day ago'
  }
  return days + ' days ago'
}

export function currentTimeMs(): number {
  return Date.now()
}
