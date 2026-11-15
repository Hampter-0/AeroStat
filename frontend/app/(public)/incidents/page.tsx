import Link from 'next/link'
import { Check, ChevronLeft, ChevronRight } from '@/components/icons'
import { getIncidents } from '@/lib/api'
import { getDisplayTime } from '@/lib/visitor-time'
import { currentMonth, isInMonth, shiftMonth, type CalendarMonth } from '@/lib/months'
import { formatDayLong } from '@/lib/time'
import type { Incident } from '@/lib/types'

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function IncidentEntry({ incident, timezone }: { incident: Incident; timezone: string }) {
  let tagClassName = 'scheduled-tag'
  let tagLabel = capitalize(incident.status)
  if (incident.status === 'resolved') {
    tagClassName = 'resolved-tag'
    tagLabel = 'Resolved'
  }

  return (
    <Link href={'/incidents/' + incident.id} className="event-preview-link">
      <div className="event-preview">
        <span className="event-marker">!</span>
        <span className="event-title-row">
          <strong>{incident.title}</strong>
          <span className={tagClassName}>{tagLabel}</span>
        </span>
        {incident.description && <span className="event-description">{incident.description}</span>}
        <span className="event-meta">Reported on {formatDayLong(incident.created_at, timezone)}</span>
      </div>
    </Link>
  )
}

export default async function IncidentsPage() {
  const { timezone } = await getDisplayTime()
  let incidents: Incident[] = []
  let backendIsDown = false

  try {
    incidents = await getIncidents()
  } catch {
    backendIsDown = true
  }

  if (backendIsDown) {
    return (
      <section className="status-unavailable">
        <h2>Status temporarily unavailable</h2>
        <p>We can&apos;t load incident history right now. Please check back in a moment.</p>
      </section>
    )
  }

  const now = currentMonth(timezone)
  const windowMonths: CalendarMonth[] = []
  let offset = 2
  while (offset >= 0) {
    windowMonths.push(shiftMonth(now.year, now.month, -offset))
    offset = offset - 1
  }
  const orderedMonths = [windowMonths[2], windowMonths[1], windowMonths[0]]

  const oldestLabel = windowMonths[0].label
  const newestLabel = windowMonths[2].label
  let rangeLabel = oldestLabel + ' to ' + newestLabel
  if (oldestLabel === newestLabel) {
    rangeLabel = newestLabel
  }

  return (
    <>
      <div className="archive-heading">
        <h1>Previous incidents</h1>
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
        {orderedMonths.map(function (month) {
          const monthLabel = month.label

          const monthIncidents = incidents.filter(function (incident) {
            return isInMonth(incident.created_at, month, timezone)
          })

          return (
            <section className="month-card" key={monthLabel}>
              <header>{monthLabel}</header>
              {monthIncidents.length === 0 && (
                <div className="month-content empty-month">
                  <Check size={15} /> <span>No incidents reported</span>
                </div>
              )}
              {monthIncidents.map(function (incident) {
                return <IncidentEntry incident={incident} timezone={timezone} key={incident.id} />
              })}
            </section>
          )
        })}
      </div>
    </>
  )
}