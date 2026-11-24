import Link from 'next/link'
import { Arrow, Check } from '@/components/icons'
import IncidentEntry from '@/components/status/IncidentEntry'
import { formatDateTimeShort, formatDayLong, formatTime } from '@/lib/time'
import type { Incident } from '@/lib/types'

export const PAST_DAYS = 7

function dayKey(iso: string, timezone: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: timezone })
}

export default function PastIncidents({ incidents, timezone, now }: { incidents: Incident[]; timezone: string; now: number }) {
  const days: { key: string; label: string; incidents: Incident[] }[] = []
  let offset = 0
  while (offset < PAST_DAYS) {
    const iso = new Date(now - offset * 24 * 60 * 60 * 1000).toISOString()
    let label = formatDayLong(iso, timezone)
    if (offset === 0) {
      label = 'Today, ' + label
    }
    days.push({ key: dayKey(iso, timezone), label: label, incidents: [] })
    offset = offset + 1
  }

  for (const incident of incidents) {
    const key = dayKey(incident.created_at, timezone)
    const day = days.find(function (item) {
      return item.key === key
    })
    if (day) {
      day.incidents.push(incident)
    }
  }

  return (
    <section className="past-incidents">
      <div className="past-incidents-head">
        <h2>Past incidents</h2>
        <Link href="/incidents" className="text-button">
          Incident history <Arrow />
        </Link>
      </div>
      {days.map(function (day) {
        return (
          <div className="past-day" key={day.key}>
            <h3>{day.label}</h3>
            {day.incidents.length === 0 && (
              <div className="month-content empty-month">
                <Check size={15} /> <span>No incidents reported</span>
              </div>
            )}
            {day.incidents.map(function (incident) {
              let meta = 'Reported at ' + formatTime(incident.created_at, timezone)
              if (incident.resolved_at && dayKey(incident.resolved_at, timezone) === day.key) {
                meta = meta + ', resolved at ' + formatTime(incident.resolved_at, timezone)
              } else if (incident.resolved_at) {
                meta = meta + ', resolved on ' + formatDateTimeShort(incident.resolved_at, timezone)
              }
              return <IncidentEntry incident={incident} meta={meta} key={incident.id} />
            })}
          </div>
        )
      })}
    </section>
  )
}
