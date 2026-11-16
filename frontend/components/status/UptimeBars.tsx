import type { CSSProperties } from 'react'
import type { DayHistory } from '@/lib/types'
import { Check, Tool, X } from '@/components/icons'

const HISTORY_DAYS = 60
const MOBILE_DAYS = 30

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

function formatPercent(value: number) {
  let text = value.toFixed(3)
  while (text.includes('.') && (text.endsWith('0') || text.endsWith('.'))) {
    text = text.slice(0, -1)
  }
  return text + '% uptime'
}

export default function UptimeBars({ days, dayNote }: { days: DayHistory[]; dayNote: string }) {
  let shownDays = days
  if (shownDays.length === 0) {
    shownDays = []
    let i = 0
    while (i < HISTORY_DAYS) {
      shownDays.push({ date: '', status: 'no_data', downtime_minutes: 0, events: [] })
      i = i + 1
    }
  }

  return (
    <>
      <div className="uptime-bars" aria-label="Uptime history">
        {shownDays.map(function (day, index) {
          let isDown = false
          if (day.status === 'offline' || day.status === 'degraded') {
            isDown = true
          }

          let stateClassName = ''
          let label = 'Operational'
          let icon = <Check size={11} />
          if (day.status === 'no_data') {
            stateClassName = ' no-data'
            label = 'No data'
          }

          let hasEvents = false
          let href = ''
          if (day.events.length > 0) {
            hasEvents = true
            const firstEvent = day.events[0]
            stateClassName = ' event'
            href = '/incidents/' + firstEvent.id
            label = 'Incident'
            icon = <X size={11} />
            if (firstEvent.kind === 'maintenance') {
              stateClassName = ' maintenance'
              href = '/maintenance/' + firstEvent.id
              label = 'Maintenance'
              icon = <Tool size={11} />
            }
          }

          if (isDown) {
            stateClassName = ' down'
            label = 'Downtime'
            icon = <X size={11} />
          }

          const centerPercent = ((index + 0.5) / shownDays.length) * 100
          const mobileIndex = index - (shownDays.length - MOBILE_DAYS)
          const mobileCenterPercent = ((mobileIndex + 0.5) / MOBILE_DAYS) * 100
          const barStyle = {
            '--bar-center': centerPercent + '%',
            '--bar-center-mobile': mobileCenterPercent + '%',
          } as CSSProperties

          let showDowntime = false
          if (day.downtime_minutes > 0 && day.status !== 'online') {
            showDowntime = true
          }

          let uptimeText = ''
          if (typeof day.uptime_percent === 'number') {
            uptimeText = formatPercent(day.uptime_percent)
          }

          let dateText = ''
          if (day.date) {
            dateText = formatDay(day.date) + dayNote
          }

          const className = 'bar' + stateClassName
          const tooltip = (
            <span className="bar-tooltip" role="tooltip">
              <strong>
                <span className="tooltip-check">{icon}</span>
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
              {dateText && <time dateTime={day.date}>{dateText}</time>}
            </span>
          )

          if (hasEvents) {
            return (
              <a key={index} className={className} style={barStyle} href={href} aria-label={dateText + ': ' + label + '. Open report.'}>
                {tooltip}
              </a>
            )
          }

          return (
            <span key={index} className={className} style={barStyle} tabIndex={0} aria-label={dateText + ': ' + label}>
              {tooltip}
            </span>
          )
        })}
      </div>
      <div className="history-labels">
        <span className="history-full">{HISTORY_DAYS} days ago</span>
        <span className="history-mobile">{MOBILE_DAYS} days ago</span>
        <span>Today</span>
      </div>
    </>
  )
}
