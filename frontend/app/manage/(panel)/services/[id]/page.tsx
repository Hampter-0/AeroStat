import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft } from '@/components/icons'
import DeleteForm from '@/components/manage/DeleteForm'
import BadgeCard from '@/components/manage/services/BadgeCard'
import ServiceForm from '@/components/manage/services/ServiceForm'
import type { DockerHostsResponse } from '@/lib/docker'
import { getSiteConfig } from '@/lib/branding'
import { can, manageFetch, requireUser } from '@/lib/manage'
import { checkTypeInfo, checkTypeLabel, intervalLabel, type ManageServicesResponse } from '@/lib/services'
import { formatDateTimeShort } from '@/lib/time'
import { deleteService } from '../actions'
import PageHeader from '@/components/manage/PageHeader'

export const metadata = {
  title: 'Service',
}

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  if (!can(user, 'services.view')) {
    redirect('/manage')
  }

  const { id } = await params
  const serviceId = decodeURIComponent(id)
  const data = await manageFetch<ManageServicesResponse>('/services')
  let dockerHosts: DockerHostsResponse | null = null
  try {
    dockerHosts = await manageFetch<DockerHostsResponse>('/docker-hosts')
  } catch {
    dockerHosts = null
  }

  let service = null
  for (const candidate of data.services) {
    if (candidate.id === serviceId) {
      service = candidate
    }
  }
  if (!service) {
    notFound()
  }

  const { timezone } = await getSiteConfig()
  let certificateText: string | null = null
  if (service.cert_expires_at) {
    certificateText = formatDateTimeShort(service.cert_expires_at, timezone)
  }

  const targetLabel = checkTypeInfo(service.check_type).target
  let dockerHostName = 'This server'
  if (dockerHosts && service.docker_host_id !== null) {
    for (const host of dockerHosts.hosts) {
      if (host.id === service.docker_host_id) {
        dockerHostName = host.name
      }
    }
  }

  let keywordText = ''
  if (service.keyword) {
    keywordText = '“' + service.keyword + '” must be on the page'
    if (service.keyword_absent) {
      keywordText = '“' + service.keyword + '” must not be on the page'
    }
  }

  const requestHeaders = await headers()
  let host = requestHeaders.get('x-forwarded-host')
  if (!host) {
    host = requestHeaders.get('host')
  }
  let protocol = requestHeaders.get('x-forwarded-proto')
  if (!protocol) {
    protocol = 'http'
  }
  let baseUrl = ''
  if (host) {
    baseUrl = protocol.split(',')[0].trim() + '://' + host.split(',')[0].trim()
  }

  return (
    <div className="manage-page">
      <Link href="/manage/services" className="back-button">
        <ChevronLeft /> Services
      </Link>
      <PageHeader
        title={service.name}
        description={<>ID <code>{service.id}</code>. Used in links and the API, it doesn&apos;t change when you rename the service.</>}
      />
      {can(user, 'services.edit') && (
        <section className="manage-panel">
          <ServiceForm groups={data.groups} service={service} defaultGroupId="" certificateText={certificateText} dockerHosts={dockerHosts} />
        </section>
      )}
      {!can(user, 'services.edit') && (
        <section className="manage-panel">
          <dl className="config-list">
            <div className="config-row">
              <dt>Check type</dt>
              <dd>{checkTypeLabel(service.check_type)}</dd>
            </div>
            <div className="config-row">
              <dt>{targetLabel}</dt>
              <dd>{service.url}</dd>
            </div>
            {service.check_type === 'http' && (
              <div className="config-row">
                <dt>Expected status codes</dt>
                <dd>{service.expected_status.join(', ')}</dd>
              </div>
            )}
            {keywordText && (
              <div className="config-row">
                <dt>Keyword</dt>
                <dd>{keywordText}</dd>
              </div>
            )}
            {service.check_type === 'docker' && (
              <div className="config-row">
                <dt>Docker host</dt>
                <dd>{dockerHostName}</dd>
              </div>
            )}
            {service.check_type === 'dns' && (
              <div className="config-row">
                <dt>Record</dt>
                <dd>
                  {service.dns_record_type}
                  {service.dns_expected && ' = ' + service.dns_expected}
                </dd>
              </div>
            )}
            {certificateText && (
              <div className="config-row">
                <dt>Certificate valid until</dt>
                <dd>{certificateText}</dd>
              </div>
            )}
            <div className="config-row">
              <dt>Check every</dt>
              <dd>{intervalLabel(service.check_interval_seconds).toLowerCase()}</dd>
            </div>
          </dl>
        </section>
      )}
      <BadgeCard serviceId={service.id} serviceName={service.name} baseUrl={baseUrl} />
      {can(user, 'services.delete') && (
        <section className="manage-panel danger">
          <h2>Delete service</h2>
          <DeleteForm
            id={service.id}
            action={deleteService}
            buttonText="Delete service"
            description="Removes the service and all its check history from the status page. Incidents and maintenance that mention it are kept."
            confirmText={'Delete ' + service.name + ' and all its check history? This cannot be undone.'}
          />
        </section>
      )}
    </div>
  )
}
