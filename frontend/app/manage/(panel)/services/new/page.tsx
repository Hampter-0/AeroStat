import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from '@/components/icons'
import ServiceForm from '@/components/manage/services/ServiceForm'
import type { DockerHostsResponse } from '@/lib/docker'
import { can, manageFetch, requireUser } from '@/lib/manage'
import type { ManageServicesResponse } from '@/lib/services'
import PageHeader from '@/components/manage/PageHeader'

export const metadata = {
  title: 'Add service',
}

export default async function NewServicePage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const user = await requireUser()
  if (!can(user, 'services.create')) {
    redirect('/manage')
  }

  const data = await manageFetch<ManageServicesResponse>('/services')
  let dockerHosts: DockerHostsResponse | null = null
  try {
    dockerHosts = await manageFetch<DockerHostsResponse>('/docker-hosts')
  } catch {
    dockerHosts = null
  }
  const { group } = await searchParams

  let defaultGroupId = ''
  if (group) {
    defaultGroupId = group
  } else if (data.groups.length > 0) {
    defaultGroupId = data.groups[0].id
  }

  return (
    <div className="manage-page">
      <Link href="/manage/services" className="back-button">
        <ChevronLeft /> Services
      </Link>
      <PageHeader title="Add service" description="AeroStat starts checking it within a few seconds." />
      <section className="manage-panel">
        <ServiceForm groups={data.groups} service={null} defaultGroupId={defaultGroupId} certificateText={null} dockerHosts={dockerHosts} />
      </section>
    </div>
  )
}
