import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from '@/components/icons'
import MaintenanceForm from '@/components/manage/maintenance/MaintenanceForm'
import { getStatus } from '@/lib/api'
import { getSiteConfig } from '@/lib/branding'
import { can, requireUser } from '@/lib/manage'

export const metadata = {
  title: 'Schedule maintenance',
}

export default async function NewMaintenancePage() {
  const user = await requireUser()
  if (!can(user, 'maintenance.create')) {
    redirect('/manage')
  }

  const services = await getStatus()
  const { timezone } = await getSiteConfig()

  return (
    <div className="manage-page">
      <Link href="/manage/maintenance" className="back-button">
        <ChevronLeft /> Maintenance
      </Link>
      <header className="manage-page-header">
        <h1>Schedule maintenance</h1>
        <p>It shows on the status page right away. The status follows the start and end time automatically.</p>
      </header>
      <section className="manage-panel">
        <MaintenanceForm services={services} maintenance={null} timezone={timezone} />
      </section>
    </div>
  )
}
