import { Check } from '@/components/icons'
import RetryButton from '@/components/status/RetryButton'
import HistoryTabs from '@/components/status/HistoryTabs'
import IncidentEntry from '@/components/status/IncidentEntry'
import RangePicker from '@/components/status/RangePicker'
import { getIncidentsBetween, hasIncidentsBefore } from '@/lib/api'
import { getDisplayTime } from '@/lib/visitor-time'
import { currentMonth, isInMonth, monthStartIso, pageHref, rangeLabel, readPage, shiftMonth, type CalendarMonth } from '@/lib/months'
import { formatDayLong } from '@/lib/time'
import type { Incident } from '@/lib/types'

export default async function IncidentsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { timezone } = await getDisplayTime()
  let page = readPage((await searchParams).page)
  if (page > 0) {
    page = 0
  }

  const now = currentMonth(timezone)
  const windowMonths: CalendarMonth[] = []
  let offset = 2
  while (offset >= 0) {
    windowMonths.push(shiftMonth(now.year, now.month, page * 3 - offset))
    offset = offset - 1
  }
  const lastMonth = windowMonths[2]
  const windowStart = monthStartIso(windowMonths[0], timezone)
  const windowEnd = monthStartIso(shiftMonth(lastMonth.year, lastMonth.month, 1), timezone)

  let incidents: Incident[] = []
  let hasOlder = false
  let backendIsDown = false

  try {
    incidents = await getIncidentsBetween(windowStart, windowEnd)
    hasOlder = await hasIncidentsBefore(windowStart)
  } catch {
    backendIsDown = true
  }

  if (backendIsDown) {
    return (
      <section className="status-unavailable">
        <h2>Status temporarily unavailable</h2>
        <p>We can&apos;t load incident history right now. Please check back in a moment.</p>
        <RetryButton />
      </section>
    )
  }

  const orderedMonths = [windowMonths[2], windowMonths[1], windowMonths[0]]

  let previousHref: string | null = null
  if (hasOlder) {
    previousHref = pageHref('/incidents', page - 1)
  }
  let nextHref: string | null = null
  if (page < 0) {
    nextHref = pageHref('/incidents', page + 1)
  }

  return (
    <>
      <div className="archive-heading">
        <HistoryTabs active="incidents" />
        <h1>Previous incidents</h1>
        <RangePicker label={rangeLabel(windowMonths)} previousHref={previousHref} nextHref={nextHref} />
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
                return (
                  <IncidentEntry incident={incident} meta={'Reported on ' + formatDayLong(incident.created_at, timezone)} key={incident.id} />
                )
              })}
            </section>
          )
        })}
      </div>
    </>
  )
}