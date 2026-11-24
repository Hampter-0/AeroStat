import Link from 'next/link'

export default function HistoryTabs({ active }: { active: 'incidents' | 'uptime' }) {
  let incidentsClass = 'history-tab'
  let uptimeClass = 'history-tab'
  if (active === 'incidents') {
    incidentsClass = 'history-tab active'
  } else {
    uptimeClass = 'history-tab active'
  }
  return (
    <nav className="history-tabs" aria-label="History">
      <Link href="/incidents" className={incidentsClass}>
        Incidents
      </Link>
      <Link href="/uptime" className={uptimeClass}>
        Uptime
      </Link>
    </nav>
  )
}
