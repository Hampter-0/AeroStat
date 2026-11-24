import StatusGlyph, { type GlyphKind } from '@/components/StatusGlyph'

export interface TimelineEntry {
  key: string
  label: string
  time: string
  message: string | null
  tone: string
  kind: GlyphKind
}

export default function Timeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <div className="detail-updates">
      {entries.map(function (entry) {
        return (
          <div className="detail-update" key={entry.key}>
            <span className={'update-marker tone-' + entry.tone}>
              <StatusGlyph kind={entry.kind} size={22} />
            </span>
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
