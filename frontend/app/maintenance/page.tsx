import Link from 'next/link'
import { Check, ChevronLeft, ChevronRight } from '@/components/icons'
import { getAllMaintenance } from '@/lib/api'
import type { MaintenanceWindow } from '@/lib/types'

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function formatFullDate(iso: string) {
  const date = new Date(iso)
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function formatTimeRange(startIso: string, endIso: string) {
  const start = new Date(startIso)
  const end = new Date(endIso)
  const startTime = start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' })
  const endTime = end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' })
  return startTime + '-' + endTime + ' UTC'
}

function MaintenanceEntry({ maintenanceWindow }: { maintenanceWindow: MaintenanceWindow }) {
  let tagClassName = 'scheduled-tag'
  let tagLabel = 'Scheduled'
  if (maintenanceWindow.status === 'in_progress') {
    tagClassName = 'in-progress-tag'
    tagLabel = 'In progress'
  } else if (maintenanceWindow.status === 'completed') {
    tagClassName = 'completed-tag'
    tagLabel = 'Completed'
  } else if (maintenanceWindow.status === 'cancelled') {
    tagClassName = 'cancelled-tag'
    tagLabel = 'Cancelled'
  }

  return (
    <Link href={'/maintenance/' + maintenanceWindow.id} className="event-preview-link">
      <div className="event-preview">
        <span className="event-marker">!</span>
        <span className="event-title-row">
          <strong>{maintenanceWindow.title}</strong>
          <span className={tagClassName}>{tagLabel}</span>
        </span>
        {maintenanceWindow.description && (
          <span className="event-description">{maintenanceWindow.description}</span>
        )}
        <span className="event-meta">
          {formatFullDate(maintenanceWindow.scheduled_start)}, {formatTimeRange(maintenanceWindow.scheduled_start, maintenanceWindow.scheduled_end)}
        </span>
      </div>
    </Link>
  )
}

export default async function MaintenancePage() {
  let maintenanceWindows: MaintenanceWindow[] = []
  let backendIsDown = false

  try {
    maintenanceWindows = await getAllMaintenance()
  } catch {
    backendIsDown = true
  }

  if (backendIsDown) {
    return (
      <section className="status-unavailable">
        <h2>Status temporarily unavailable</h2>
        <p>We can&apos;t load maintenance history right now. Please check back in a moment.</p>
      </section>
    )
  }

  const now = new Date()
  const windowMonths: Date[] = []
  let offset = -1
  while (offset <= 1) {
    const monthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1))
    windowMonths.push(monthDate)
    offset = offset + 1
  }

  const oldestLabel = formatMonthLabel(windowMonths[0])
  const newestLabel = formatMonthLabel(windowMonths[2])
  let rangeLabel = oldestLabel + ' to ' + newestLabel
  if (oldestLabel === newestLabel) {
    rangeLabel = newestLabel
  }

  return (
    <>
      <div className="archive-heading">
        <h1>Maintenance</h1>
        <div className="range-picker">
          <button aria-label="Previous months" disabled>
            <ChevronLeft />
          </button>
          <span>{rangeLabel}</span>
          <button aria-label="Next months" disabled>
            <ChevronRight />
          </button>
        </div>
      </div>

      <div className="archive-list">
        {windowMonths.map(function (monthDate) {
          const monthLabel = formatMonthLabel(monthDate)

          const monthWindows = maintenanceWindows.filter(function (maintenanceWindow) {
            const startDate = new Date(maintenanceWindow.scheduled_start)
            let sameMonth = false
            if (
              startDate.getUTCFullYear() === monthDate.getUTCFullYear() &&
              startDate.getUTCMonth() === monthDate.getUTCMonth()
            ) {
              sameMonth = true
            }
            return sameMonth
          })

          return (
            <section className="month-card" key={monthLabel}>
              <header>{monthLabel}</header>
              {monthWindows.length === 0 && (
                <div className="month-content empty-month">
                  <Check size={15} /> <span>No maintenance scheduled</span>
                </div>
              )}
              {monthWindows.map(function (maintenanceWindow) {
                return <MaintenanceEntry maintenanceWindow={maintenanceWindow} key={maintenanceWindow.id} />
              })}
            </section>
          )
        })}
      </div>
    </>
  )
}