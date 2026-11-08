import { Check, ChevronLeft, ChevronRight } from '@/components/icons'
import { getIncidents } from '@/lib/api'
import type { Incident } from '@/lib/types'

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function formatFullDate(iso: string) {
  const date = new Date(iso)
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function IncidentEntry({ incident }: { incident: Incident }) {
  var tagClassName = 'scheduled-tag'
  var tagLabel = capitalize(incident.status)
  if (incident.status === 'resolved') {
    tagClassName = 'resolved-tag'
    tagLabel = 'Resolved'
  }

  return (
    <div className="event-preview">
      <span className="event-title-row">
        <strong>{incident.title}</strong>
        <span className={tagClassName}>{tagLabel}</span>
      </span>
      {incident.description && <span className="event-description">{incident.description}</span>}
      <span className="event-meta">Reported on {formatFullDate(incident.created_at)}</span>
    </div>
  )
}

export default async function IncidentsPage() {
  var incidents: Incident[] = []
  var backendIsDown = false

  try {
    incidents = await getIncidents()
  } catch (error) {
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

  const now = new Date()
  const windowMonths: Date[] = []
  var offset = 2
  while (offset >= 0) {
    const monthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1))
    windowMonths.push(monthDate)
    offset = offset - 1
  }
  // windowMonths is now [oldest, middle, newest], and we display
  // newest-first, same direction as the incidents list itself.
  const orderedMonths = [windowMonths[2], windowMonths[1], windowMonths[0]]

  const oldestLabel = formatMonthLabel(windowMonths[0])
  const newestLabel = formatMonthLabel(windowMonths[2])
  var rangeLabel = oldestLabel + ' to ' + newestLabel
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
        {orderedMonths.map(function (monthDate) {
          const monthLabel = formatMonthLabel(monthDate)

          const monthIncidents = incidents.filter(function (incident) {
            const incidentDate = new Date(incident.created_at)
            var sameMonth = false
            if (
              incidentDate.getUTCFullYear() === monthDate.getUTCFullYear() &&
              incidentDate.getUTCMonth() === monthDate.getUTCMonth()
            ) {
              sameMonth = true
            }
            return sameMonth
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
                return <IncidentEntry incident={incident} key={incident.id} />
              })}
            </section>
          )
        })}
      </div>
    </>
  )
}