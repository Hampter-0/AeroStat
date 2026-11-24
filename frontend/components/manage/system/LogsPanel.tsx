'use client'

import { useEffect, useRef, useState } from 'react'
import { clearLogs, fetchLogs } from '@/app/manage/(panel)/system/logs-actions'
import { Check, Search } from '@/components/icons'
import { useConfirm } from '@/components/manage/confirm/Confirm'
import { useToast } from '@/components/manage/toast/Toasts'
import { LOG_LEVELS, logsQuery, type LogLine, type LogsResponse } from '@/lib/logs'

const POLL_MS = 5000
const SHOWN = 500

function formatTime(iso: string, timezone: string): string {
  const date = new Date(iso)
  const day = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: timezone })
  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: timezone })
  return day + ' ' + time
}

export default function LogsPanel({ initial, timezone }: { initial: LogsResponse; timezone: string }) {
  const [level, setLevel] = useState('all')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [lines, setLines] = useState<LogLine[]>(initial.lines)
  const [matched, setMatched] = useState(initial.matched)
  const [loading, setLoading] = useState(false)
  const latest = useRef({ level: 'all', query: '', newest: 0 })
  const confirm = useConfirm()
  const toast = useToast()

  let newest = 0
  if (lines.length > 0) {
    newest = lines[0].id
  }

  useEffect(
    function () {
      latest.current = { level: level, query: query, newest: newest }
    },
    [level, query, newest]
  )

  useEffect(
    function () {
      const timer = window.setInterval(function () {
        if (document.visibilityState !== 'visible') {
          return
        }
        const asked = latest.current
        let after: number | null = null
        if (asked.newest > 0) {
          after = asked.newest
        }
        fetchLogs(asked.level, asked.query, after).then(function (result) {
          if (!result || result.lines.length === 0) {
            return
          }
          const now = latest.current
          if (now.level !== asked.level || now.query !== asked.query) {
            return
          }
          setLines(function (current) {
            return result.lines.concat(current).slice(0, SHOWN)
          })
          setMatched(function (current) {
            return current + result.matched
          })
        })
      }, POLL_MS)
      return function () {
        window.clearInterval(timer)
      }
    },
    []
  )

  function load(nextLevel: string, nextQuery: string) {
    setLoading(true)
    fetchLogs(nextLevel, nextQuery, null).then(function (result) {
      setLoading(false)
      if (result) {
        setLines(result.lines)
        setMatched(result.matched)
      }
    })
  }

  function changeLevel(event: React.ChangeEvent<HTMLSelectElement>) {
    setLevel(event.target.value)
    load(event.target.value, query)
  }

  function changeSearch(event: React.ChangeEvent<HTMLInputElement>) {
    setSearch(event.target.value)
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setQuery(search)
    load(level, search)
  }

  function clearAll() {
    confirm({
      title: 'Clear the logs?',
      message: 'Everyone with access sees an empty list. The terminal and docker logs keep everything, and the activity log notes that you cleared them.',
      confirmText: 'Clear logs',
      danger: true,
    }).then(function (ok) {
      if (!ok) {
        return
      }
      clearLogs().then(function (done) {
        if (!done) {
          toast('Could not clear the logs', 'error')
          return
        }
        toast('Logs cleared', 'success')
        load(level, query)
      })
    })
  }

  let countText = 'No log lines yet.'
  if (matched > 0) {
    countText = matched + ' lines'
    if (matched === 1) {
      countText = '1 line'
    }
    if (matched > lines.length) {
      countText = 'Newest ' + lines.length + ' of ' + matched + ' lines'
    }
  }
  if (query !== '' || level !== 'all') {
    countText = countText + ' that match'
  }
  if (matched > 0) {
    countText = countText + '.'
  }

  let emptyText = 'Nothing logged yet since the backend started.'
  if (query !== '' || level !== 'all') {
    emptyText = 'No lines match.'
  }

  return (
    <section className="manage-panel activity-panel">
      <div className="table-toolbar logs-toolbar">
        <form className="activity-search" onSubmit={submitSearch} role="search">
          <Search />
          <input type="search" value={search} onChange={changeSearch} placeholder="Search and press Enter…" aria-label="Search logs" maxLength={100} />
        </form>
        <label className="per-page">
          <span className="sr-only">Level</span>
          <select value={level} onChange={changeLevel}>
            {LOG_LEVELS.map(function (option) {
              return (
                <option value={option.id} key={option.id}>
                  {option.label}
                </option>
              )
            })}
          </select>
        </label>
        <span className="logs-live on">
          <span className="logs-live-icon">
            <Check size={11} />
          </span>
          Live
        </span>
        <div className="logs-actions">
          <a className="button-secondary" href={'/manage/logs/download?' + logsQuery(level, query)}>
            Download
          </a>
          <button type="button" className="button-danger" onClick={clearAll}>
            Clear
          </button>
        </div>
      </div>
      <p className="logs-count">
        {countText} The backend keeps the newest {initial.capacity} lines in memory until it restarts.
      </p>
      <div className="logs-view" aria-busy={loading}>
        {lines.length === 0 && <p className="manage-empty logs-empty">{emptyText}</p>}
        {lines.map(function (line) {
          return (
            <div className={'logs-line level-' + line.level} key={line.id}>
              <time dateTime={line.time}>{formatTime(line.time, timezone)}</time>
              <span className="logs-level">{line.level}</span>
              <span className="logs-target">{line.target}</span>
              <span className="logs-message">{line.message}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
