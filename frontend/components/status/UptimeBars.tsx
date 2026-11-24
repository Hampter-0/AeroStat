import type { CSSProperties } from 'react'
import type { DayHistory } from '@/lib/types'
import DayCell from '@/components/status/DayCell'

const HISTORY_DAYS = 60
const MOBILE_DAYS = 30

export default function UptimeBars({ days, dayNote }: { days: DayHistory[]; dayNote: string }) {
  let shownDays = days
  if (shownDays.length === 0) {
    shownDays = []
    let i = 0
    while (i < HISTORY_DAYS) {
      shownDays.push({ date: '', status: 'no_data', downtime_minutes: 0, events: [] })
      i = i + 1
    }
  }

  return (
    <>
      <div className="uptime-bars" aria-label="Uptime history">
        {shownDays.map(function (day, index) {
          const centerPercent = ((index + 0.5) / shownDays.length) * 100
          const mobileIndex = index - (shownDays.length - MOBILE_DAYS)
          const mobileCenterPercent = ((mobileIndex + 0.5) / MOBILE_DAYS) * 100
          const barStyle = {
            '--bar-center': centerPercent + '%',
            '--bar-center-mobile': mobileCenterPercent + '%',
          } as CSSProperties
          return <DayCell day={day} dayNote={dayNote} className="bar" style={barStyle} key={index} />
        })}
      </div>
      <div className="history-labels">
        <span className="history-full">{HISTORY_DAYS} days ago</span>
        <span className="history-mobile">{MOBILE_DAYS} days ago</span>
        <span>Today</span>
      </div>
    </>
  )
}
