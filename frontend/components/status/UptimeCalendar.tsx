import DayCell, { formatPercent } from '@/components/status/DayCell'
import { monthLabel } from '@/lib/months'
import type { DayHistory, MonthHistory } from '@/lib/types'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function firstWeekday(year: number, month: number): number {
  return (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7
}

function pad(value: number): string {
  if (value < 10) {
    return '0' + value
  }
  return String(value)
}

export default function UptimeCalendar({ month, dayNote }: { month: MonthHistory; dayNote: string }) {
  const total = daysInMonth(month.year, month.month)
  const offset = firstWeekday(month.year, month.month)
  const byDate = new Map<string, DayHistory>()
  for (const day of month.days) {
    byDate.set(day.date, day)
  }

  const cells = []
  let i = 0
  while (i < offset) {
    cells.push(<span className="calendar-blank" key={'blank-' + i} />)
    i = i + 1
  }
  let dayNumber = 1
  while (dayNumber <= total) {
    const date = month.year + '-' + pad(month.month) + '-' + pad(dayNumber)
    const day = byDate.get(date)
    const column = (offset + dayNumber - 1) % 7
    let edge = ''
    if (column <= 1) {
      edge = ' edge-left'
    } else if (column >= 5) {
      edge = ' edge-right'
    }
    if (day) {
      cells.push(<DayCell day={day} dayNote={dayNote} className={'bar calendar-day' + edge} key={date} />)
    } else {
      cells.push(<span className="calendar-day future" key={date} aria-hidden="true" />)
    }
    dayNumber = dayNumber + 1
  }

  let uptimeText = 'No data'
  if (month.uptime_percent !== null) {
    uptimeText = formatPercent(month.uptime_percent)
  }

  return (
    <section className="calendar-month">
      <header>
        <h2>{monthLabel(month.year, month.month)}</h2>
        <span>{uptimeText}</span>
      </header>
      <div className="calendar-weekdays" aria-hidden="true">
        {WEEKDAYS.map(function (name) {
          return <span key={name}>{name}</span>
        })}
      </div>
      <div className="calendar-grid">{cells}</div>
    </section>
  )
}
