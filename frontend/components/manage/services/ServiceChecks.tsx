'use client'

import { useState } from 'react'
import { testService } from '@/app/manage/(panel)/services/actions'
import StatusGlyph from '@/components/StatusGlyph'
import type { CheckEntry, CheckTest } from '@/lib/services'

function timeText(iso: string, timezone: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: timezone,
  })
}

function CheckLine({ entry, timezone }: { entry: CheckEntry; timezone: string }) {
  const [open, setOpen] = useState(false)
  const online = entry.status === 'online'
  let toneClass = 'event-icon tone-red'
  let kind: 'check' | 'x' = 'x'
  if (online) {
    toneClass = 'event-icon tone-green'
    kind = 'check'
  }
  let summary = entry.response_time + ' ms'
  if (entry.status_code !== null) {
    summary = summary + ', status ' + entry.status_code
  }
  const canOpen = !online && (entry.details !== null || entry.error !== null)

  function toggle() {
    setOpen(!open)
  }

  let toggleText = 'Details'
  if (open) {
    toggleText = 'Hide details'
  }

  return (
    <li className="check-line">
      <div className="check-line-head">
        <span className={toneClass}>
          <StatusGlyph kind={kind} size={18} />
        </span>
        <time dateTime={entry.checked_at}>{timeText(entry.checked_at, timezone)}</time>
        <span className="check-line-summary">{summary}</span>
        {!online && entry.error && <span className="check-line-error">{entry.error}</span>}
        {canOpen && (
          <button type="button" className="link-button" onClick={toggle} aria-expanded={open}>
            {toggleText}
          </button>
        )}
      </div>
      {open && entry.details && <pre className="check-details">{entry.details}</pre>}
    </li>
  )
}

export default function ServiceChecks({
  serviceId,
  checks,
  timezone,
  canTest,
}: {
  serviceId: string
  checks: CheckEntry[]
  timezone: string
  canTest: boolean
}) {
  const [visible, setVisible] = useState(10)
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<CheckTest | null>(null)
  const [error, setError] = useState<string | null>(null)

  function runTest() {
    setTesting(true)
    setError(null)
    testService(serviceId).then(function (answer) {
      setTesting(false)
      setResult(answer.result)
      setError(answer.error)
    })
  }

  function showMore() {
    setVisible(visible + 10)
  }

  let testText = 'Test now'
  if (testing) {
    testText = 'Testing…'
  }

  let resultClass = 'check-test failed'
  let resultTitle = ''
  if (result) {
    if (result.status === 'online') {
      resultClass = 'check-test ok'
      resultTitle = 'Up, ' + result.response_time + ' ms'
    } else if (result.status === 'starting') {
      resultClass = 'check-test waiting'
      resultTitle = 'Still starting'
    } else {
      resultTitle = 'Down, ' + result.response_time + ' ms'
    }
    if (result.status_code !== null) {
      resultTitle = resultTitle + ', status ' + result.status_code
    }
  }

  return (
    <section className="manage-panel">
      <div className="panel-heading">
        <h2>Recent checks</h2>
        {canTest && (
          <button type="button" className="button-secondary" onClick={runTest} disabled={testing}>
            {testText}
          </button>
        )}
      </div>
      {error && <p className="check-test failed">{error}</p>}
      {result && (
        <div className={resultClass}>
          <strong>{resultTitle}</strong>
          {result.error && <span>{result.error}</span>}
          {result.details && <pre className="check-details">{result.details}</pre>}
          <small>A test is not saved and never sends a notification.</small>
        </div>
      )}
      {checks.length === 0 && <p className="manage-empty">No checks yet.</p>}
      {checks.length > 0 && (
        <ul className="check-lines">
          {checks.slice(0, visible).map(function (entry) {
            return <CheckLine entry={entry} timezone={timezone} key={entry.checked_at} />
          })}
        </ul>
      )}
      {checks.length > visible && (
        <button type="button" className="link-button check-more" onClick={showMore}>
          Show more
        </button>
      )}
    </section>
  )
}
