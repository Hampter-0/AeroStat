import HistoryTabs from '@/components/status/HistoryTabs'
import RangePicker from '@/components/status/RangePicker'
import UptimeCalendar from '@/components/status/UptimeCalendar'
import UptimeServiceSelect from '@/components/status/UptimeServiceSelect'
import { getStatus, getUptimeHistory } from '@/lib/api'
import { readPage, shortMonthLabel } from '@/lib/months'
import { zoneAbbreviation } from '@/lib/time'
import type { ServiceStatus, UptimeHistory } from '@/lib/types'
import { getDisplayTime } from '@/lib/visitor-time'

export const metadata = {
  title: 'Uptime',
}

function uptimeHref(service: string, page: number): string {
  let href = '/uptime?service=' + encodeURIComponent(service)
  if (page !== 0) {
    href = href + '&page=' + page
  }
  return href
}

export default async function UptimePage({ searchParams }: { searchParams: Promise<{ service?: string; page?: string }> }) {
  const params = await searchParams
  const { timezone, siteTimezone } = await getDisplayTime()
  let dayNote = ''
  if (timezone !== siteTimezone) {
    dayNote = ' (' + zoneAbbreviation(siteTimezone) + ')'
  }
  let page = readPage(params.page)
  if (page > 0) {
    page = 0
  }

  let services: ServiceStatus[] = []
  let backendIsDown = false
  try {
    services = await getStatus()
  } catch {
    backendIsDown = true
  }

  if (backendIsDown) {
    return (
      <section className="status-unavailable">
        <h2>Status temporarily unavailable</h2>
        <p>We can&apos;t load the uptime history right now. Please check back in a moment.</p>
      </section>
    )
  }

  let selected = ''
  if (services.length > 0) {
    selected = services[0].id
  }
  const asked = services.find(function (service) {
    return service.id === params.service
  })
  if (asked) {
    selected = asked.id
  }

  let history: UptimeHistory | null = null
  if (selected) {
    history = await getUptimeHistory(selected, page)
  }

  let rangeText = ''
  let previousHref: string | null = null
  let nextHref: string | null = null
  if (history && history.months.length > 0) {
    const first = history.months[0]
    const last = history.months[history.months.length - 1]
    rangeText = shortMonthLabel(first.year, first.month) + ' to ' + shortMonthLabel(last.year, last.month)
    if (history.has_older) {
      previousHref = uptimeHref(selected, page - 1)
    }
    if (page < 0) {
      nextHref = uptimeHref(selected, page + 1)
    }
  }

  const options = services.map(function (service) {
    return { id: service.id, name: service.name }
  })

  return (
    <>
      <div className="archive-heading">
        <HistoryTabs active="uptime" />
        <h1>Uptime history</h1>
        {services.length > 0 && (
          <div className="uptime-controls">
            <UptimeServiceSelect services={options} selected={selected} />
            {rangeText && <RangePicker label={rangeText} previousHref={previousHref} nextHref={nextHref} />}
          </div>
        )}
      </div>

      <div className="archive-list uptime-months">
        {services.length === 0 && <p className="live-status-empty">Nothing is being monitored yet.</p>}
        {services.length > 0 && !history && <p className="live-status-empty">The uptime history could not be loaded.</p>}
        {history &&
          history.months
            .slice()
            .reverse()
            .map(function (month) {
              return <UptimeCalendar month={month} dayNote={dayNote} key={month.year + '-' + month.month} />
            })}
      </div>
    </>
  )
}
