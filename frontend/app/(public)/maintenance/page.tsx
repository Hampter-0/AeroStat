import Link from 'next/link'
import { Check, ChevronLeft, ChevronRight } from '@/components/icons'
import { getAllMaintenance } from '@/lib/api'
import { getDisplayTime } from '@/lib/visitor-time'
import { currentMonth, isInMonth, shiftMonth, type CalendarMonth } from '@/lib/months'
import { formatDayLong, formatTimeRange } from '@/lib/time'
import type { MaintenanceWindow } from '@/lib/types'

function MaintenanceEntry({ maintenanceWindow, timezone }: { maintenanceWindow: MaintenanceWindow; timezone: string }) {
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
          {formatDayLong(maintenanceWindow.scheduled_start, timezone)}, {formatTimeRange(maintenanceWindow.scheduled_start, maintenanceWindow.scheduled_end, timezone)}
        </span>
      </div>
    </Link>
  )
}

export default async function MaintenancePage() {
  const { timezone } = await getDisplayTime()
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

  const now = currentMonth(timezone)
  const windowMonths: CalendarMonth[] = []
  let offset = -1
  while (offset <= 1) {
    windowMonths.push(shiftMonth(now.year, now.month, offset))
    offset = offset + 1
  }

  const oldestLabel = windowMonths[0].label
  const newestLabel = windowMonths[2].label
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
        {windowMonths.map(function (month) {
          const monthLabel = month.label

          const monthWindows = maintenanceWindows.filter(function (maintenanceWindow) {
            return isInMonth(maintenanceWindow.scheduled_start, month, timezone)
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
                return <MaintenanceEntry maintenanceWindow={maintenanceWindow} timezone={timezone} key={maintenanceWindow.id} />
              })}
            </section>
          )
        })}
      </div>
    </>
  )
}