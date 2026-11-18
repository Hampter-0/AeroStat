import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Check, PendingRing, X } from '@/components/icons'
import AddGroupForm from '@/components/manage/services/AddGroupForm'
import CheckNowButton from '@/components/manage/services/CheckNowButton'
import GroupHeader from '@/components/manage/services/GroupHeader'
import MoveButtons from '@/components/manage/services/MoveButtons'
import { getStatus, getUptime } from '@/lib/api'
import { can, manageFetch, requireUser } from '@/lib/manage'
import { intervalLabel, type ManageService, type ManageServicesResponse } from '@/lib/services'
import { moveService } from './actions'

export const metadata = {
  title: 'Services',
}

function targetText(service: ManageService): string {
  let text = service.url
  if (service.check_type === 'tcp') {
    text = 'TCP ' + service.url
  } else if (service.check_type === 'dns') {
    let record = 'A'
    if (service.dns_record_type) {
      record = service.dns_record_type
    }
    text = 'DNS ' + record + ' ' + service.url
  }
  return text
}

interface ServiceStats {
  uptime: number
  avgMs: number
  checks: number
}

function ServiceRows({
  services,
  liveStatus,
  stats,
  canMove,
}: {
  services: ManageService[]
  liveStatus: Map<string, string | null>
  stats: Map<string, ServiceStats>
  canMove: boolean
}) {
  if (services.length === 0) {
    return <p className="manage-empty">No services in this group yet.</p>
  }

  return (
    <div className="manage-list">
      {services.map(function (service, index) {
        let statusClass = 'service-status unknown'
        let statusLabel = 'Not checked yet'
        let statusIcon = <PendingRing size={16} />
        const status = liveStatus.get(service.id)
        if (status === 'online') {
          statusClass = 'service-status online'
          statusLabel = 'Online'
          statusIcon = <Check size={13} />
        } else if (status === 'offline') {
          statusClass = 'service-status offline'
          statusLabel = 'Down'
          statusIcon = <X size={12} />
        }

        return (
          <div className="manage-list-row service-row" key={service.id}>
            <span className={statusClass} title={statusLabel} aria-label={statusLabel}>
              {statusIcon}
            </span>
            <Link href={'/manage/services/' + encodeURIComponent(service.id)} className="service-row-main">
              <strong>{service.name}</strong>
              <span>
                {targetText(service)} · {intervalLabel(service.check_interval_seconds).toLowerCase()}
              </span>
            </Link>
            <ServiceStatsCell stats={stats.get(service.id)} />
            {canMove && (
              <MoveButtons
                id={service.id}
                label={service.name}
                isFirst={index === 0}
                isLast={index === services.length - 1}
                action={moveService}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function ServiceStatsCell({ stats }: { stats: ServiceStats | undefined }) {
  if (!stats || stats.checks === 0) {
    return (
      <div className="service-stats">
        <span>No data yet</span>
      </div>
    )
  }
  return (
    <div className="service-stats" title="Last 60 days">
      <span>
        <b>{stats.uptime}%</b> uptime
      </span>
      <span>
        <b>{stats.avgMs} ms</b> avg
      </span>
    </div>
  )
}

export default async function ManageServicesPage() {
  const user = await requireUser()
  if (!can(user, 'services.view')) {
    redirect('/manage')
  }

  const data = await manageFetch<ManageServicesResponse>('/services')
  const status = await getStatus()
  const canCreate = can(user, 'services.create')
  const canEdit = can(user, 'services.edit')
  const canEditGroups = can(user, 'groups.edit')
  const canDeleteGroups = can(user, 'groups.delete')

  const liveStatus = new Map<string, string | null>()
  for (const service of status) {
    liveStatus.set(service.id, service.status)
  }

  const stats = new Map<string, ServiceStats>()
  const uptimes = await Promise.all(
    data.services.map(function (service) {
      return getUptime(service.id).catch(function () {
        return null
      })
    })
  )
  for (const uptime of uptimes) {
    if (uptime) {
      stats.set(uptime.service_id, {
        uptime: uptime.uptime_percent,
        avgMs: uptime.avg_response_time_ms,
        checks: uptime.total_checks,
      })
    }
  }

  const servicesByGroup = new Map<string, ManageService[]>()
  const ungrouped: ManageService[] = []
  for (const service of data.services) {
    if (service.group_id) {
      if (!servicesByGroup.has(service.group_id)) {
        servicesByGroup.set(service.group_id, [])
      }
      servicesByGroup.get(service.group_id)!.push(service)
    } else {
      ungrouped.push(service)
    }
  }

  return (
    <div className="manage-page">
      <header className="manage-page-header with-action">
        <div>
          <h1>Services</h1>
          <p>What AeroStat checks, grouped the way visitors see it on the status page.</p>
        </div>
        <div className="header-actions">
          {can(user, 'services.check') && <CheckNowButton />}
          {canCreate && (
            <Link href="/manage/services/new" className="button-primary">
              Add service
            </Link>
          )}
        </div>
      </header>

      {data.groups.map(function (group, index) {
        let services: ManageService[] = []
        if (servicesByGroup.has(group.id)) {
          services = servicesByGroup.get(group.id)!
        }
        return (
          <section className="manage-panel" key={group.id + '-' + group.name}>
            <GroupHeader
              id={group.id}
              name={group.name}
              serviceCount={services.length}
              isFirst={index === 0}
              isLast={index === data.groups.length - 1}
              canEdit={canEditGroups}
              canDelete={canDeleteGroups}
            />
            <ServiceRows services={services} liveStatus={liveStatus} stats={stats} canMove={canEdit} />
            {canCreate && (
              <Link href={'/manage/services/new?group=' + encodeURIComponent(group.id)} className="link-button add-to-group">
                + Add service to {group.name}
              </Link>
            )}
          </section>
        )
      })}

      {ungrouped.length > 0 && (
        <section className="manage-panel">
          <div className="group-header">
            <h2>Other</h2>
          </div>
          <ServiceRows services={ungrouped} liveStatus={liveStatus} stats={stats} canMove={canEdit} />
        </section>
      )}

      {can(user, 'groups.create') && (
        <section className="manage-panel">
          <h2>Add group</h2>
          <AddGroupForm />
        </section>
      )}
    </div>
  )
}
