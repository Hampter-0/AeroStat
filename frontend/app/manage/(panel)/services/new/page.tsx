import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from '@/components/icons'
import ServiceForm from '@/components/manage/services/ServiceForm'
import { can, manageFetch, requireUser } from '@/lib/manage'
import type { ManageServicesResponse } from '@/lib/services'

export const metadata = {
  title: 'Add service',
}

export default async function NewServicePage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const user = await requireUser()
  if (!can(user, 'services')) {
    redirect('/manage')
  }

  const data = await manageFetch<ManageServicesResponse>('/services')
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
      <header className="manage-page-header">
        <h1>Add service</h1>
        <p>AeroStat starts checking it within a few seconds.</p>
      </header>
      <section className="manage-panel">
        <ServiceForm groups={data.groups} service={null} defaultGroupId={defaultGroupId} />
      </section>
    </div>
  )
}
