import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { AlertTriangle, Check, Clock, Cpu, Database, ExternalLink, Layers, MemoryChip, Package, Terminal } from '@/components/icons'
import UpdateCheck from '@/components/manage/system/UpdateCheck'
import { getSiteConfig } from '@/lib/branding'
import { manageFetch, requireUser } from '@/lib/manage'
import { formatBytes, formatCount, formatMs, type SystemInfo } from '@/lib/system'
import { currentTimeMs, formatAgo, formatDateTimeShort, formatDuration } from '@/lib/time'
import { getVersionInfo } from '@/lib/version'

export const metadata = {
  title: 'System',
}

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'updates', label: 'Updates' },
  { id: 'health', label: 'Health' },
]

const CHECK_STALE_MS = 30 * 60000

function InfoTile({ icon, label, value, note }: { icon: ReactNode; label: string; value: string; note?: string }) {
  return (
    <div className="info-tile">
      <span className="info-tile-icon">{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {note && <small>{note}</small>}
      </div>
    </div>
  )
}

function HealthTile({ ok, label, value, note }: { ok: boolean; label: string; value: string; note: string }) {
  let className = 'health-tile ok'
  let icon = <Check size={14} />
  if (!ok) {
    className = 'health-tile warn'
    icon = <AlertTriangle size={14} />
  }
  return (
    <div className={className}>
      <span className="health-tile-icon">{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </div>
  )
}

export default async function SystemPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser()
  if (!user.is_admin) {
    redirect('/manage')
  }
  const { tab } = await searchParams
  let activeTab = 'overview'
  for (const option of TABS) {
    if (option.id === tab) {
      activeTab = option.id
    }
  }

  const { timezone } = await getSiteConfig()
  const system = await manageFetch<SystemInfo>('/system')
  const version = await getVersionInfo()
  const now = currentTimeMs()
  const overview = system.overview

  let memoryValue = 'Unknown'
  if (overview.memory_total_bytes !== null && overview.memory_used_bytes !== null) {
    const percent = ((overview.memory_used_bytes / overview.memory_total_bytes) * 100).toFixed(1)
    memoryValue = formatBytes(overview.memory_used_bytes) + ' / ' + formatBytes(overview.memory_total_bytes) + ' (' + percent + '%)'
  }
  let memoryNote = ''
  if (overview.process_memory_bytes !== null) {
    memoryNote = formatBytes(overview.process_memory_bytes) + ' used by the AeroStat backend'
  }

  let cpuValue = 'Unknown'
  if (overview.cpu) {
    cpuValue = overview.cpu
  }
  let kernelValue = 'Unknown'
  if (overview.kernel) {
    kernelValue = overview.kernel
  }
  let containerValue = 'Not in Docker'
  if (overview.in_docker) {
    containerValue = 'Docker'
  }
  let postgresValue = 'Unknown'
  if (overview.postgres_version) {
    postgresValue = 'PostgreSQL ' + overview.postgres_version
  }
  let redisValue = 'Unknown'
  if (overview.redis_version) {
    redisValue = 'Redis ' + overview.redis_version
  }

  const health = system.health
  const migrationsOk = health.migrations_applied === health.migrations_total
  let migrationsNote = 'Some migrations did not run. Check the backend logs'
  if (migrationsOk) {
    migrationsNote = 'The database schema is up to date'
  }
  let versionCheckedText = ''
  if (version && version.checked_at) {
    versionCheckedText = formatAgo(now - new Date(version.checked_at).getTime())
  }
  let lastCheckValue = 'Never'
  let lastCheckOk = system.counts.services === 0
  let lastCheckNote = 'Add a service to start checking'
  if (health.last_check_at) {
    const age = now - new Date(health.last_check_at).getTime()
    lastCheckValue = formatAgo(age)
    lastCheckOk = age < CHECK_STALE_MS
    lastCheckNote = 'The checker runs every 5 seconds and checks services when they are due'
    if (!lastCheckOk) {
      lastCheckNote = 'No check in the last 30 minutes. Is the backend running?'
    }
  }

  return (
    <div className="manage-page">
      <header className="manage-page-header">
        <h1>System</h1>
        <p>The server AeroStat runs on, its version and its health.</p>
      </header>

      <nav className="settings-tabs" aria-label="System sections">
        {TABS.map(function (option) {
          let className = ''
          if (option.id === activeTab) {
            className = 'active'
          }
          return (
            <Link href={'/manage/system?tab=' + option.id} className={className} key={option.id}>
              {option.label}
            </Link>
          )
        })}
      </nav>

      {activeTab === 'overview' && (
        <>
          <section className="manage-panel">
            <h2>Server</h2>
            <div className="info-grid">
              <InfoTile icon={<Cpu />} label={'CPU (' + overview.cpu_cores + ' cores)'} value={cpuValue} />
              <InfoTile icon={<MemoryChip />} label="Memory" value={memoryValue} note={memoryNote} />
              <InfoTile icon={<Terminal />} label={'Kernel (' + overview.arch + ')'} value={kernelValue} />
              <InfoTile icon={<Package />} label="Runs in" value={containerValue} />
              <InfoTile
                icon={<Clock />}
                label="Backend uptime"
                value={formatDuration(now - new Date(overview.started_at).getTime())}
                note={'Since ' + formatDateTimeShort(overview.started_at, timezone)}
              />
              <InfoTile icon={<Check size={18} />} label="AeroStat" value={'v' + overview.version} />
            </div>
          </section>

          <section className="manage-panel">
            <h2>Database and cache</h2>
            <div className="info-grid">
              <InfoTile icon={<Database />} label="Database" value={postgresValue} note={formatBytes(overview.database_size_bytes) + ' on disk'} />
              <InfoTile icon={<Layers />} label="Cache" value={redisValue} note={formatBytes(overview.redis_memory_bytes) + ' in memory'} />
            </div>
          </section>

          <section className="manage-panel">
            <h2>Statistics</h2>
            <div className="count-grid">
              <div className="stat-tile">
                <span>Users</span>
                <strong>{formatCount(system.counts.users)}</strong>
              </div>
              <div className="stat-tile">
                <span>Services</span>
                <strong>{formatCount(system.counts.services)}</strong>
                <small>in {system.counts.groups} groups</small>
              </div>
              <div className="stat-tile">
                <span>Incidents</span>
                <strong>{formatCount(system.counts.incidents)}</strong>
                <small>{system.counts.ongoing_incidents} ongoing</small>
              </div>
              <div className="stat-tile">
                <span>Maintenance</span>
                <strong>{formatCount(system.counts.maintenance)}</strong>
              </div>
              <div className="stat-tile">
                <span>Checks stored</span>
                <strong>{formatCount(system.counts.checks_stored)}</strong>
              </div>
              <div className="stat-tile">
                <span>Activity log</span>
                <strong>{formatCount(system.counts.activity_entries)}</strong>
                <small>entries</small>
              </div>
            </div>
          </section>
        </>
      )}

      {activeTab === 'updates' && (
        <>
          {version && (
            <section className="manage-panel">
              <h2>Version</h2>
              <UpdateCheck version={version} checkedText={versionCheckedText} />
            </section>
          )}

          <section className="manage-panel">
            <h2>Version history</h2>
            {system.history.length === 0 && <p className="manage-empty">No releases found yet. Check for updates to load them.</p>}
            {system.history.length > 0 && (
              <div className="activity-table-wrap">
                <table className="activity-table history-table">
                  <thead>
                    <tr>
                      <th>Version</th>
                      <th>Released</th>
                      <th>Running here since</th>
                      <th>
                        <span className="sr-only">Release notes</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {system.history.map(function (entry) {
                      let released = '–'
                      if (entry.published_at) {
                        released = formatDateTimeShort(entry.published_at, timezone)
                      }
                      let installed = 'Not installed'
                      if (entry.installed_at) {
                        installed = formatDateTimeShort(entry.installed_at, timezone)
                      }
                      return (
                        <tr key={entry.version}>
                          <td>
                            <code>v{entry.version}</code>
                            {entry.version === overview.version && <span className="chip admin">Current</span>}
                          </td>
                          <td>{released}</td>
                          <td>{installed}</td>
                          <td className="history-link">
                            {entry.url && (
                              <a href={entry.url} target="_blank" rel="noreferrer" className="link-button">
                                Notes <ExternalLink />
                              </a>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {activeTab === 'health' && (
        <section className="manage-panel">
          <h2>Health</h2>
          <div className="info-grid">
            <HealthTile
              ok={migrationsOk}
              label="Database migrations"
              value={health.migrations_applied + ' / ' + health.migrations_total}
              note={migrationsNote}
            />
            <HealthTile
              ok={health.database_ms !== null}
              label="Database response"
              value={formatMs(health.database_ms)}
              note="Time for one query to PostgreSQL"
            />
            <HealthTile
              ok={health.redis_ms !== null}
              label="Cache response"
              value={formatMs(health.redis_ms)}
              note="Time for one request to Redis"
            />
            <HealthTile ok={lastCheckOk} label="Last service check" value={lastCheckValue} note={lastCheckNote} />
          </div>
        </section>
      )}
    </div>
  )
}
