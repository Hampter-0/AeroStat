import Link from 'next/link'
import { Check } from '@/components/icons'
import RangePicker from '@/components/status/RangePicker'
import { getAllMaintenance } from '@/lib/api'
import { getDisplayTime } from '@/lib/visitor-time'
import { currentMonth, isInMonth, monthStartIso, pageHref, rangeLabel, readPage, shiftMonth, type CalendarMonth } from '@/lib/months'
import { formatWindow } from '@/lib/time'
import type { MaintenanceWindow } from '@/lib/types'
import { maintenanceTone } from '@/lib/maintenance'

function MaintenanceEntry({ maintenanceWindow, timezone }: { maintenanceWindow: MaintenanceWindow; timezone: string }) {
  const tagClassName = 'state-badge tone-' + maintenanceTone(maintenanceWindow.status)
  let tagLabel = 'Scheduled'
  if (maintenanceWindow.status === 'in_progress') {
    tagLabel = 'In progress'
  } else if (maintenanceWindow.status === 'completed') {
    tagLabel = 'Completed'
  } else if (maintenanceWindow.status === 'cancelled') {
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
          {formatWindow(maintenanceWindow.scheduled_start, maintenanceWindow.scheduled_end, timezone)}
        </span>
      </div>
    </Link>
  )
}

export default async function MaintenancePage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { timezone } = await getDisplayTime()
  const page = readPage((await searchParams).page)
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
    windowMonths.push(shiftMonth(now.year, now.month, page * 3 + offset))
    offset = offset + 1
  }
  const lastMonth = windowMonths[2]
  const windowStart = new Date(monthStartIso(windowMonths[0], timezone)).getTime()
  const windowEnd = new Date(monthStartIso(shiftMonth(lastMonth.year, lastMonth.month, 1), timezone)).getTime()

  let hasEarlier = false
  let hasLater = false
  for (const maintenanceWindow of maintenanceWindows) {
    const start = new Date(maintenanceWindow.scheduled_start).getTime()
    if (start < windowStart) {
      hasEarlier = true
    }
    if (start >= windowEnd) {
      hasLater = true
    }
  }

  let previousHref: string | null = null
  if (hasEarlier) {
    previousHref = pageHref('/maintenance', page - 1)
  }
  let nextHref: string | null = null
  if (hasLater) {
    nextHref = pageHref('/maintenance', page + 1)
  }

  return (
    <>
      <div className="archive-heading">
        <h1>Maintenance</h1>
        <RangePicker label={rangeLabel(windowMonths)} previousHref={previousHref} nextHref={nextHref} />
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