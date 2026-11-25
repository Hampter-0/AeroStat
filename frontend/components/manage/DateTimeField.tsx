'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from '@/components/icons'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface Parts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

function pad(value: number): string {
  if (value < 10) {
    return '0' + value
  }
  return String(value)
}

function parse(value: string): Parts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value)
  if (!match) {
    return null
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  }
}

function format(parts: Parts): string {
  return parts.year + '-' + pad(parts.month) + '-' + pad(parts.day) + 'T' + pad(parts.hour) + ':' + pad(parts.minute)
}

function nowParts(timezone?: string | null): Parts {
  const now = new Date()
  if (!timezone) {
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      hour: now.getHours(),
      minute: now.getMinutes(),
    }
  }
  const values: Record<string, number> = {}
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  })
  for (const part of formatter.formatToParts(now)) {
    values[part.type] = Number(part.value)
  }
  return { year: values.year, month: values.month, day: values.day, hour: values.hour, minute: values.minute }
}

function daysIn(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export default function DateTimeField({
  name,
  defaultValue,
  value,
  onChange,
  required,
  placeholder,
  timezone,
}: {
  name: string
  defaultValue?: string
  value?: string
  onChange?: (value: string) => void
  required?: boolean
  placeholder?: string
  timezone?: string | null
}) {
  let start = ''
  if (defaultValue) {
    start = defaultValue
  }
  const [own, setOwn] = useState(start)
  let current = own
  if (value !== undefined) {
    current = value
  }
  const parts = parse(current)
  let base = nowParts(timezone)
  if (parts) {
    base = parts
  }
  const [open, setOpen] = useState(false)
  const [view, setView] = useState({ year: base.year, month: base.month })
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(
    function () {
      if (!open) {
        return
      }
      function onDown(event: MouseEvent) {
        if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
          setOpen(false)
        }
      }
      function onKey(event: KeyboardEvent) {
        if (event.key === 'Escape') {
          setOpen(false)
        }
      }
      document.addEventListener('mousedown', onDown)
      document.addEventListener('keydown', onKey)
      return function () {
        document.removeEventListener('mousedown', onDown)
        document.removeEventListener('keydown', onKey)
      }
    },
    [open]
  )

  function set(next: string) {
    setOwn(next)
    if (onChange) {
      onChange(next)
    }
  }

  function toggle() {
    if (!open) {
      setView({ year: base.year, month: base.month })
    }
    setOpen(!open)
  }

  function shiftMonth(by: number) {
    let month = view.month + by
    let year = view.year
    if (month < 1) {
      month = 12
      year = year - 1
    } else if (month > 12) {
      month = 1
      year = year + 1
    }
    setView({ year: year, month: month })
  }

  function pickDay(day: number) {
    set(format({ year: view.year, month: view.month, day: day, hour: base.hour, minute: base.minute }))
  }

  function changeHour(event: React.ChangeEvent<HTMLSelectElement>) {
    set(format({ year: base.year, month: base.month, day: base.day, hour: Number(event.target.value), minute: base.minute }))
  }

  function changeMinute(event: React.ChangeEvent<HTMLSelectElement>) {
    set(format({ year: base.year, month: base.month, day: base.day, hour: base.hour, minute: Number(event.target.value) }))
  }

  function pickNow() {
    const now = nowParts(timezone)
    set(format(now))
    setView({ year: now.year, month: now.month })
  }

  function clear() {
    set('')
    setOpen(false)
  }

  function ignore() {}

  let shown = placeholder || 'Pick a date and time'
  let shownClass = 'date-field-value placeholder'
  if (parts) {
    shown = parts.day + ' ' + SHORT_MONTHS[parts.month - 1] + ' ' + parts.year + ', ' + pad(parts.hour) + ':' + pad(parts.minute)
    shownClass = 'date-field-value'
  }

  const today = nowParts(timezone)
  const offset = (new Date(view.year, view.month - 1, 1).getDay() + 6) % 7
  const cells = []
  let blank = 0
  while (blank < offset) {
    cells.push(<span key={'blank-' + blank} />)
    blank = blank + 1
  }
  let day = 1
  const total = daysIn(view.year, view.month)
  while (day <= total) {
    const thisDay = day
    let className = 'date-day'
    if (parts && parts.year === view.year && parts.month === view.month && parts.day === thisDay) {
      className = className + ' selected'
    }
    if (today.year === view.year && today.month === view.month && today.day === thisDay) {
      className = className + ' today'
    }
    cells.push(
      <button
        type="button"
        className={className}
        key={thisDay}
        onClick={function () {
          pickDay(thisDay)
        }}
      >
        {thisDay}
      </button>
    )
    day = day + 1
  }

  const hours = []
  let hour = 0
  while (hour < 24) {
    hours.push(
      <option value={hour} key={hour}>
        {pad(hour)}
      </option>
    )
    hour = hour + 1
  }
  const minutes = []
  let minute = 0
  while (minute < 60) {
    minutes.push(
      <option value={minute} key={minute}>
        {pad(minute)}
      </option>
    )
    minute = minute + 1
  }

  return (
    <div className="date-field" ref={boxRef}>
      <button type="button" className="date-field-button" onClick={toggle} aria-expanded={open}>
        <span className={shownClass}>{shown}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 10h18" />
        </svg>
      </button>
      <input className="date-field-input" name={name} value={current} onChange={ignore} required={required} tabIndex={-1} aria-hidden="true" />
      {open && (
        <div className="date-popover">
          <div className="date-head">
            <button
              type="button"
              className="date-nav"
              onClick={function () {
                shiftMonth(-1)
              }}
              aria-label="Previous month"
            >
              <ChevronLeft />
            </button>
            <strong>
              {MONTHS[view.month - 1]} {view.year}
            </strong>
            <button
              type="button"
              className="date-nav"
              onClick={function () {
                shiftMonth(1)
              }}
              aria-label="Next month"
            >
              <ChevronRight />
            </button>
          </div>
          <div className="date-weekdays" aria-hidden="true">
            {WEEKDAYS.map(function (weekday) {
              return <span key={weekday}>{weekday}</span>
            })}
          </div>
          <div className="date-grid">{cells}</div>
          <div className="date-time">
            <span>Time</span>
            <select value={base.hour} onChange={changeHour} aria-label="Hour">
              {hours}
            </select>
            <b>:</b>
            <select value={base.minute} onChange={changeMinute} aria-label="Minute">
              {minutes}
            </select>
          </div>
          <div className="date-actions">
            <button type="button" className="link-button" onClick={pickNow}>
              Now
            </button>
            {!required && (
              <button type="button" className="link-button" onClick={clear}>
                Clear
              </button>
            )}
            <button
              type="button"
              className="button-primary date-done"
              onClick={function () {
                setOpen(false)
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
