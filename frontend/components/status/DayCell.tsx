import type { CSSProperties } from 'react'
import type { DayHistory } from '@/lib/types'
import StatusGlyph, { type GlyphKind } from '@/components/StatusGlyph'

function formatDay(dateText: string) {
  const date = new Date(dateText + 'T00:00:00Z')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

function formatMinutes(minutes: number) {
  let text = minutes + ' minutes'
  if (minutes === 1) {
    text = '1 minute'
  }
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    const rest = minutes % 60
    text = hours + 'h ' + rest + 'm'
  }
  return text
}

export function formatPercent(value: number) {
  let text = value.toFixed(3)
  while (text.includes('.') && (text.endsWith('0') || text.endsWith('.'))) {
    text = text.slice(0, -1)
  }
  return text + '%'
}

export default function DayCell({
  day,
  dayNote,
  className,
  style,
}: {
  day: DayHistory
  dayNote: string
  className: string
  style?: CSSProperties
}) {
  let isDown = false
  if (day.status === 'offline' || day.status === 'degraded') {
    isDown = true
  }

  let stateClassName = ''
  let label = 'Operational'
  let kind: GlyphKind = 'check'
  if (day.status === 'no_data') {
    stateClassName = ' no-data'
    label = 'No data'
    kind = 'pending'
  }

  let hasEvents = false
  let href = ''
  if (day.events.length > 0) {
    hasEvents = true
    const firstEvent = day.events[0]
    stateClassName = ' event'
    href = '/incidents/' + firstEvent.id
    label = 'Incident'
    kind = 'alert'
    const maintenanceEvent = day.events.find(function (event) {
      return event.kind === 'maintenance'
    })
    if (maintenanceEvent) {
      stateClassName = ' maintenance'
      href = '/maintenance/' + maintenanceEvent.id
      label = 'Maintenance'
      kind = 'wrench'
    }
  }

  if (isDown) {
    stateClassName = ' down'
    label = 'Downtime'
    kind = 'alert'
  }

  if (day.status === 'maintenance') {
    stateClassName = ' maintenance'
    label = 'Maintenance'
    kind = 'wrench'
    for (const event of day.events) {
      if (event.kind === 'maintenance') {
        href = '/maintenance/' + event.id
      }
    }
  }

  let showDowntime = false
  if (day.downtime_minutes > 0 && day.status !== 'online') {
    showDowntime = true
  }

  let uptimeText = ''
  if (typeof day.uptime_percent === 'number') {
    uptimeText = formatPercent(day.uptime_percent) + ' uptime'
  }

  let responseText = ''
  if (typeof day.avg_response_time_ms === 'number') {
    responseText = 'Avg response ' + day.avg_response_time_ms + ' ms'
  }

  let dateText = ''
  if (day.date) {
    dateText = formatDay(day.date) + dayNote
  }

  const fullClassName = className + stateClassName
  const tooltip = (
    <span className="bar-tooltip" role="tooltip">
      <strong>
        <span className="tooltip-check">
          <StatusGlyph kind={kind} size={18} />
        </span>
        {label}
      </strong>
      {day.events.map(function (event) {
        return (
          <span className="tooltip-event" key={event.kind + '-' + event.id}>
            {event.title}
          </span>
        )
      })}
      {showDowntime && <span className="downtime-duration">Down for {formatMinutes(day.downtime_minutes)}</span>}
      {!showDowntime && !hasEvents && uptimeText && <span className="tooltip-calm">No problems</span>}
      {uptimeText && <span className="tooltip-uptime">{uptimeText}</span>}
      {responseText && <span className="tooltip-uptime tooltip-response">{responseText}</span>}
      {dateText && <time dateTime={day.date}>{dateText}</time>}
    </span>
  )

  if (hasEvents) {
    return (
      <a className={fullClassName} style={style} href={href} aria-label={dateText + ': ' + label + '. Open report.'}>
        {tooltip}
      </a>
    )
  }

  return (
    <span className={fullClassName} style={style} tabIndex={0} aria-label={dateText + ': ' + label}>
      {tooltip}
    </span>
  )
}
