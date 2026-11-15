import Link from 'next/link'
import Avatar from '@/components/manage/Avatar'
import { activityLink, type ActivityEntry } from '@/lib/activity'
import { currentTimeMs, formatDateTimeShort, formatDuration } from '@/lib/time'

const DAY_MS = 86400000

function whenText(iso: string, now: number, timezone: string): string {
  const age = now - new Date(iso).getTime()
  if (age < 60000) {
    return 'just now'
  }
  if (age < DAY_MS) {
    return formatDuration(age) + ' ago'
  }
  return formatDateTimeShort(iso, timezone)
}

export default function ActivityList({
  entries,
  timezone,
  showIp,
}: {
  entries: ActivityEntry[]
  timezone: string
  showIp: boolean
}) {
  const now = currentTimeMs()

  return (
    <ol className="activity-list">
      {entries.map(function (entry) {
        const href = activityLink(entry)
        let target = null
        if (entry.target_label && href) {
          target = <Link href={href}>{entry.target_label}</Link>
        } else if (entry.target_label) {
          target = <strong>{entry.target_label}</strong>
        }

        return (
          <li className="activity-row" key={entry.id}>
            <Avatar userId={entry.user_id || 0} username={entry.username} version={entry.avatar_version} size={26} />
            <p>
              <strong>{entry.username}</strong> {entry.action} {target}
            </p>
            <span className="activity-meta">
              {showIp && entry.ip && <span>{entry.ip}</span>}
              <time dateTime={entry.created_at} title={formatDateTimeShort(entry.created_at, timezone)}>
                {whenText(entry.created_at, now, timezone)}
              </time>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
