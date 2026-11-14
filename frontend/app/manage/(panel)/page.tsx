import Link from 'next/link'
import { Arrow } from '@/components/icons'
import { can, requireUser } from '@/lib/manage'

export default async function ManageOverviewPage() {
  const user = await requireUser()

  return (
    <div className="manage-page">
      <header className="manage-page-header">
        <h1>Welcome, {user.username}</h1>
      </header>

      <div className="manage-cards">
        {can(user, 'incidents') && (
          <Link href="/manage/incidents" className="manage-card">
            <strong>Incidents</strong>
            <span>Report problems and post updates for visitors.</span>
            <em>
              Open <Arrow />
            </em>
          </Link>
        )}
        {user.is_admin && (
          <Link href="/manage/users" className="manage-card">
            <strong>Users</strong>
            <span>Add people and choose what they can manage.</span>
            <em>
              Open <Arrow />
            </em>
          </Link>
        )}
        <a href="/" target="_blank" className="manage-card">
          <strong>Status page</strong>
          <span>See the public page as visitors see it.</span>
          <em>
            Open <Arrow />
          </em>
        </a>
      </div>
    </div>
  )
}
