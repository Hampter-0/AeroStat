import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from '@/components/icons'
import IncidentForm from '@/components/manage/incidents/IncidentForm'
import { getStatus } from '@/lib/api'
import { can, requireUser } from '@/lib/manage'

export const metadata = {
  title: 'New incident',
}

export default async function NewIncidentPage() {
  const user = await requireUser()
  if (!can(user, 'incidents')) {
    redirect('/manage')
  }

  const services = await getStatus()

  return (
    <div className="manage-page">
      <Link href="/manage/incidents" className="back-button">
        <ChevronLeft /> Incidents
      </Link>
      <header className="manage-page-header">
        <h1>New incident</h1>
        <p>It shows up on the status page as soon as you create it.</p>
      </header>
      <section className="manage-panel">
        <IncidentForm services={services} incident={null} />
      </section>
    </div>
  )
}
