import type { ReactNode } from 'react'

export interface TimelineEntry {
  key: string
  label: string
  time: string
  message: string | null
  markerClassName: string
  icon: ReactNode
}

export default function Timeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <div className="detail-updates">
      {entries.map(function (entry) {
        return (
          <div className="detail-update" key={entry.key}>
            <span className={entry.markerClassName}>{entry.icon}</span>
            <div className="update-card">
              <div>
                <strong>{entry.label}</strong>
                <time>{entry.time}</time>
              </div>
              {entry.message && <p>{entry.message}</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
