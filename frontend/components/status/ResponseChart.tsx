'use client'

import { useState } from 'react'
import type { ResponsePoint, ResponseTimes } from '@/lib/types'

const WIDTH = 1000
const HEIGHT = 120
const PAD_TOP = 6

const RANGES = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
]

const HOUR_MS = 60 * 60 * 1000

interface ChartService {
  id: string
  name: string
}

interface Plotted {
  x: number
  y: number
  point: ResponsePoint
}

interface Tick {
  time: number
  label: string
}

function niceMax(value: number): number {
  if (value <= 0) {
    return 100
  }
  const raw = (value * 1.1) / 3
  const power = Math.pow(10, Math.floor(Math.log10(raw)))
  for (const step of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (step * power >= raw) {
      return step * power * 3
    }
  }
  return 30 * power
}

function linePath(points: Plotted[]): string {
  let path = ''
  points.forEach(function (item, index) {
    let command = ' L'
    if (index === 0) {
      command = 'M'
    }
    path = path + command + item.x.toFixed(1) + ' ' + item.y.toFixed(1)
  })
  return path
}

function localParts(time: number, timezone: string): { hour: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', day: 'numeric', hourCycle: 'h23', timeZone: timezone }).formatToParts(new Date(time))
  let hour = 0
  let day = 1
  for (const part of parts) {
    if (part.type === 'hour') {
      hour = Number(part.value)
    } else if (part.type === 'day') {
      day = Number(part.value)
    }
  }
  return { hour: hour, day: day }
}

function dayLabel(time: number, timezone: string): string {
  return new Date(time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: timezone })
}

function hourLabel(time: number, timezone: string): string {
  return new Date(time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone })
}

function timeTicks(from: number, to: number, timezone: string): Tick[] {
  const span = to - from
  if (span <= 3 * HOUR_MS) {
    let minuteStep = 30
    if (span <= 1.5 * HOUR_MS) {
      minuteStep = 15
    }
    const stepMs = minuteStep * 60 * 1000
    const short: Tick[] = []
    let moment = Math.ceil(from / stepMs) * stepMs
    while (moment <= to) {
      short.push({ time: moment, label: hourLabel(moment, timezone) })
      moment = moment + stepMs
    }
    return short
  }

  let hourStep = 3
  if (span > 2 * 24 * HOUR_MS) {
    hourStep = 24
  }
  if (span > 10 * 24 * HOUR_MS) {
    hourStep = 48
  }
  if (span <= 8 * HOUR_MS) {
    hourStep = 1
  }

  const ticks: Tick[] = []
  let midnights = 0
  let time = Math.ceil(from / HOUR_MS) * HOUR_MS
  while (time <= to) {
    const local = localParts(time, timezone)
    if (hourStep >= 24) {
      if (local.hour === 0) {
        if (hourStep === 24 || midnights % 2 === 0) {
          ticks.push({ time: time, label: dayLabel(time, timezone) })
        }
        midnights = midnights + 1
      }
    } else if (local.hour % hourStep === 0) {
      let label = hourLabel(time, timezone)
      if (local.hour === 0) {
        label = dayLabel(time, timezone)
      }
      ticks.push({ time: time, label: label })
    }
    time = time + HOUR_MS
  }
  return ticks
}

function formatPoint(iso: string, timezone: string): string {
  const date = new Date(iso)
  const day = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: timezone })
  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone })
  return day + ', ' + time
}

export default function ResponseChart({
  initial,
  services,
  timezone,
}: {
  initial: ResponseTimes
  services: ChartService[]
  timezone: string
}) {
  const [data, setData] = useState<ResponseTimes>(initial)
  const [range, setRange] = useState(initial.range)
  const [service, setService] = useState('')
  const [loading, setLoading] = useState(false)
  const [hover, setHover] = useState<number | null>(null)

  function load(nextRange: string, nextService: string) {
    setLoading(true)
    const params = new URLSearchParams({ range: nextRange })
    if (nextService) {
      params.set('service', nextService)
    }
    fetch('/api/response-times?' + params.toString())
      .then(function (res) {
        if (!res.ok) {
          return null
        }
        return res.json()
      })
      .then(function (result: ResponseTimes | null) {
        setLoading(false)
        if (result) {
          setData(result)
          setHover(null)
        }
      })
      .catch(function () {
        setLoading(false)
      })
  }

  function chooseRange(next: string) {
    setRange(next)
    load(next, service)
  }

  function chooseService(event: React.ChangeEvent<HTMLSelectElement>) {
    setService(event.target.value)
    load(range, event.target.value)
  }

  const bucketMs = data.bucket_seconds * 1000
  let from = new Date(data.from).getTime()
  const to = new Date(data.to).getTime()
  let sinceText = ''
  if (data.points.length > 0) {
    const first = new Date(data.points[0].t).getTime()
    if (first - from > bucketMs * 2) {
      from = first + bucketMs / 2
      sinceText = ', since ' + formatPoint(data.points[0].t, timezone)
    }
  }
  const span = Math.max(1, to - from)

  let highest = 0
  let total = 0
  for (const point of data.points) {
    total = total + point.ms
    if (point.ms > highest) {
      highest = point.ms
    }
  }
  const max = niceMax(highest)

  function xFor(time: number): number {
    return (Math.min(span, Math.max(0, time - from)) / span) * WIDTH
  }

  function yFor(ms: number): number {
    return PAD_TOP + (HEIGHT - PAD_TOP) * (1 - ms / max)
  }

  const plotted: Plotted[] = data.points.map(function (point) {
    return { x: xFor(new Date(point.t).getTime() + bucketMs / 2), y: yFor(point.ms), point: point }
  })

  const enough = plotted.length >= 2
  const line = linePath(plotted)

  let averageText = ''
  if (data.points.length > 0) {
    averageText = Math.round(total / data.points.length) + ' ms'
  }

  const yTicks = [max, (max * 2) / 3, max / 3, 0]
  const xTicks = timeTicks(from, to, timezone)

  function onPointer(event: React.PointerEvent<SVGSVGElement>) {
    if (plotted.length === 0) {
      return
    }
    const box = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - box.left) / box.width) * WIDTH
    let best = 0
    let bestDistance = Infinity
    plotted.forEach(function (item, index) {
      const distance = Math.abs(item.x - x)
      if (distance < bestDistance) {
        bestDistance = distance
        best = index
      }
    })
    setHover(best)
  }

  function onLeave() {
    setHover(null)
  }

  let crosshair = null
  let overlay = null
  if (hover !== null && plotted[hover]) {
    const item = plotted[hover]
    let side = 'left'
    if (item.x > WIDTH / 2) {
      side = 'right'
    }
    crosshair = <line x1={item.x} x2={item.x} y1={0} y2={HEIGHT} className="chart-crosshair" />
    overlay = (
      <>
        <span className="chart-dot" style={{ left: (item.x / WIDTH) * 100 + '%', top: (item.y / HEIGHT) * 100 + '%' }} />
        <div className={'chart-tooltip ' + side} style={{ left: (item.x / WIDTH) * 100 + '%' }}>
          <span>{formatPoint(item.point.t, timezone)}</span>
          <strong>{item.point.ms} ms</strong>
        </div>
      </>
    )
  }

  let plotClass = 'chart-plot'
  if (loading) {
    plotClass = 'chart-plot loading'
  }

  return (
    <section className="response-chart">
      <div className="response-chart-head">
        <h2>Response time</h2>
        <div className="response-chart-controls">
          {services.length > 1 && (
            <select className="chart-select" value={service} onChange={chooseService} aria-label="Service">
              <option value="">All services</option>
              {services.map(function (item) {
                return (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                )
              })}
            </select>
          )}
          <div className="chart-tabs" role="tablist" aria-label="Time range">
            {RANGES.map(function (option) {
              let className = ''
              if (option.id === range) {
                className = 'active'
              }
              return (
                <button
                  type="button"
                  role="tab"
                  aria-selected={option.id === range}
                  className={className}
                  key={option.id}
                  onClick={function () {
                    chooseRange(option.id)
                  }}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
      <div className="response-chart-card">
        <div className="response-chart-title">
          <span>Average response time{sinceText}</span>
          {averageText && <strong>{averageText}</strong>}
        </div>
        {!enough && <p className="chart-empty">Not enough checks yet for this period. The graph fills in as new checks come in.</p>}
        {enough && (
          <div className="chart-body">
            <div className={plotClass}>
              <svg
                viewBox={'0 0 ' + WIDTH + ' ' + HEIGHT}
                preserveAspectRatio="none"
                role="img"
                aria-label={'Average response time ' + averageText}
                onPointerDown={onPointer}
                onPointerMove={onPointer}
                onPointerLeave={onLeave}
              >
                {yTicks.map(function (value) {
                  let className = 'chart-grid'
                  if (value === 0) {
                    className = 'chart-grid baseline'
                  }
                  return <line x1={0} x2={WIDTH} y1={yFor(value)} y2={yFor(value)} className={className} key={value} />
                })}
                {xTicks.map(function (tick) {
                  return <line x1={xFor(tick.time)} x2={xFor(tick.time)} y1={HEIGHT} y2={HEIGHT + 6} className="chart-tick" key={tick.time} />
                })}
                <path d={line} className="chart-line" />
                {crosshair}
              </svg>
              {overlay}
              <div className="chart-y">
                {yTicks.map(function (value) {
                  return (
                    <span style={{ top: (yFor(value) / HEIGHT) * 100 + '%' }} key={value}>
                      {Math.round(value)}
                    </span>
                  )
                })}
              </div>
            </div>
            <div className="chart-x">
              {xTicks.map(function (tick) {
                return (
                  <span style={{ left: (xFor(tick.time) / WIDTH) * 100 + '%' }} key={tick.time}>
                    {tick.label}
                  </span>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
