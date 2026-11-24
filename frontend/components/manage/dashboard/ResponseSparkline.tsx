'use client'

import { useState } from 'react'
import { formatTime } from '@/lib/time'

export interface HourPoint {
  hour: string
  avg_ms: number | null
}

const WIDTH = 240
const HEIGHT = 56
const PAD_TOP = 6
const PAD_BOTTOM = 4
const INSET = 5

function pointX(index: number, count: number): number {
  return INSET + (index * (WIDTH - INSET * 2)) / (count - 1)
}

function pointY(value: number, max: number): number {
  return PAD_TOP + (HEIGHT - PAD_TOP - PAD_BOTTOM) * (1 - value / max)
}

function buildPath(points: HourPoint[], max: number): string {
  let path = ''
  points.forEach(function (point, index) {
    if (point.avg_ms === null) {
      return
    }
    let command = 'L'
    if (path === '') {
      command = 'M'
    }
    path = path + command + pointX(index, points.length).toFixed(1) + ' ' + pointY(point.avg_ms, max).toFixed(1) + ' '
  })
  return path.trim()
}

function singlePoint(points: HourPoint[], max: number): string {
  let found = ''
  let count = 0
  points.forEach(function (point, index) {
    if (point.avg_ms !== null) {
      count = count + 1
      const x = pointX(index, points.length).toFixed(1)
      const y = pointY(point.avg_ms, max).toFixed(1)
      found = 'M' + x + ' ' + y + ' L' + x + ' ' + y
    }
  })
  if (count === 1) {
    return found
  }
  return ''
}

export default function ResponseSparkline({
  name,
  points,
  timezone,
}: {
  name: string
  points: HourPoint[]
  timezone: string
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const values: number[] = []
  for (const point of points) {
    if (point.avg_ms !== null) {
      values.push(point.avg_ms)
    }
  }

  let max = 1
  if (values.length > 0) {
    max = Math.max(...values) * 1.15
  }

  let latest: number | null = null
  for (const point of points) {
    if (point.avg_ms !== null) {
      latest = point.avg_ms
    }
  }

  let latestText = 'No data'
  if (latest !== null) {
    latestText = latest + ' ms'
  }

  let rangeText = ''
  if (values.length > 0) {
    let total = 0
    for (const value of values) {
      total = total + value
    }
    const average = Math.round(total / values.length)
    rangeText = '24h avg ' + average + ' ms, min ' + Math.min(...values) + ', max ' + Math.max(...values)
  }

  let summary = name + ': no response time data in the last 24 hours'
  if (values.length > 0) {
    summary =
      name +
      ': response time over the last 24 hours, lowest ' +
      Math.min(...values) +
      ' ms, highest ' +
      Math.max(...values) +
      ' ms, latest ' +
      latestText
  }

  function onPointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - box.left) / box.width) * WIDTH
    const index = Math.round(((x - INSET) / (WIDTH - INSET * 2)) * (points.length - 1))
    setHoverIndex(Math.max(0, Math.min(points.length - 1, index)))
  }

  function onPointerLeave() {
    setHoverIndex(null)
  }

  let crosshair = null
  let tooltip = null
  if (hoverIndex !== null) {
    const point = points[hoverIndex]
    const x = pointX(hoverIndex, points.length)
    let marker = null
    if (point.avg_ms !== null) {
      const y = pointY(point.avg_ms, max)
      marker = <path d={'M' + x + ' ' + y + ' L' + x + ' ' + y} className="sparkline-dot hover" />
    }
    crosshair = (
      <>
        <line x1={x} x2={x} y1={0} y2={HEIGHT} className="sparkline-crosshair" />
        {marker}
      </>
    )
    let valueText = 'No data'
    if (point.avg_ms !== null) {
      valueText = point.avg_ms + ' ms'
    }
    let side = 'left'
    if (hoverIndex > points.length / 2) {
      side = 'right'
    }
    tooltip = (
      <div className={'sparkline-tooltip ' + side} style={{ left: (x / WIDTH) * 100 + '%' }}>
        <strong>{valueText}</strong>
        <span>{formatTime(point.hour, timezone)}</span>
      </div>
    )
  }

  return (
    <div className="sparkline">
      <div className="sparkline-head">
        <strong>{name}</strong>
        <span>
          <b>{latestText}</b> last hour
        </span>
      </div>
      {rangeText && <p className="sparkline-range">{rangeText}</p>}
      <div className="sparkline-plot">
        <svg
          viewBox={'0 0 ' + WIDTH + ' ' + HEIGHT}
          preserveAspectRatio="none"
          role="img"
          aria-label={summary}
          onPointerDown={onPointerMove}
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
        >
          <line x1={0} x2={WIDTH} y1={HEIGHT - 0.5} y2={HEIGHT - 0.5} className="sparkline-baseline" />
          <path d={buildPath(points, max)} className="sparkline-line" />
          <path d={singlePoint(points, max)} className="sparkline-dot" />
          {crosshair}
        </svg>
        {tooltip}
      </div>
      <div className="sr-only">
        <table>
          <caption>{name} response time per hour</caption>
          <tbody>
            {points.map(function (point) {
              let cell = 'No data'
              if (point.avg_ms !== null) {
                cell = point.avg_ms + ' ms'
              }
              return (
                <tr key={point.hour}>
                  <th scope="row">{formatTime(point.hour, timezone)}</th>
                  <td>{cell}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
