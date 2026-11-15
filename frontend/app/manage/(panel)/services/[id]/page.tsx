import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft } from '@/components/icons'
import DeleteForm from '@/components/manage/DeleteForm'
import ServiceForm from '@/components/manage/services/ServiceForm'
import { can, manageFetch, requireUser } from '@/lib/manage'
import type { ManageServicesResponse } from '@/lib/services'
import { deleteService } from '../actions'

export const metadata = {
  title: 'Service',
}

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  if (!can(user, 'services')) {
    redirect('/manage')
  }

  const { id } = await params
  const serviceId = decodeURIComponent(id)
  const data = await manageFetch<ManageServicesResponse>('/services')

  let service = null
  for (const candidate of data.services) {
    if (candidate.id === serviceId) {
      service = candidate
    }
  }
  if (!service) {
    notFound()
  }

  return (
    <div className="manage-page">
      <Link href="/manage/services" className="back-button">
        <ChevronLeft /> Services
      </Link>
      <header className="manage-page-header">
        <h1>{service.name}</h1>
        <p>
          ID <code>{service.id}</code>. Used in links and the API, it doesn&apos;t change when you rename the service.
        </p>
      </header>
      <section className="manage-panel">
        <ServiceForm groups={data.groups} service={service} defaultGroupId="" />
      </section>
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
    </div>
  )
}
