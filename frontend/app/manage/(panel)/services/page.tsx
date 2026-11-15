import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Check, X } from '@/components/icons'
import AddGroupForm from '@/components/manage/services/AddGroupForm'
import CheckNowButton from '@/components/manage/services/CheckNowButton'
import GroupHeader from '@/components/manage/services/GroupHeader'
import MoveButtons from '@/components/manage/services/MoveButtons'
import { getStatus } from '@/lib/api'
import { can, manageFetch, requireUser } from '@/lib/manage'
import { intervalLabel, type ManageService, type ManageServicesResponse } from '@/lib/services'
import { moveService } from './actions'

export const metadata = {
  title: 'Services',
}

function ServiceRows({ services, liveStatus }: { services: ManageService[]; liveStatus: Map<string, string | null> }) {
  if (services.length === 0) {
    return <p className="manage-empty">No services in this group yet.</p>
  }

  return (
    <div className="manage-list">
      {services.map(function (service, index) {
        let statusClass = 'service-status unknown'
        let statusLabel = 'Not checked yet'
        let statusIcon = null
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
                {service.url} · {intervalLabel(service.check_interval_seconds).toLowerCase()}
              </span>
            </Link>
            <MoveButtons
              id={service.id}
              label={service.name}
              isFirst={index === 0}
              isLast={index === services.length - 1}
              action={moveService}
            />
          </div>
        )
      })}
    </div>
  )
}

export default async function ManageServicesPage() {
  const user = await requireUser()
  if (!can(user, 'services')) {
    redirect('/manage')
  }

  const data = await manageFetch<ManageServicesResponse>('/services')
  const status = await getStatus()

  const liveStatus = new Map<string, string | null>()
  for (const service of status) {
    liveStatus.set(service.id, service.status)
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
          <CheckNowButton />
          <Link href="/manage/services/new" className="button-primary">
            Add service
          </Link>
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
            />
            <ServiceRows services={services} liveStatus={liveStatus} />
            <Link href={'/manage/services/new?group=' + encodeURIComponent(group.id)} className="link-button add-to-group">
              + Add service to {group.name}
            </Link>
          </section>
        )
      })}

      {ungrouped.length > 0 && (
        <section className="manage-panel">
          <div className="group-header">
            <h2>Other</h2>
          </div>
          <ServiceRows services={ungrouped} liveStatus={liveStatus} />
        </section>
      )}

      <section className="manage-panel">
        <h2>Add group</h2>
        <AddGroupForm />
      </section>
    </div>
  )
}
