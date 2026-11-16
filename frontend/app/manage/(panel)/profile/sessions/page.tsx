import ProfileTabs from '@/components/manage/profile/ProfileTabs'
import SessionsTable from '@/components/manage/profile/SessionsTable'
import { manageFetch, requireUser } from '@/lib/manage'
import { describeAgent, type SessionInfo, type SessionRow } from '@/lib/sessions'
import { currentTimeMs, formatAgo } from '@/lib/time'

export const metadata = {
  title: 'Sessions',
}

export default async function SessionsPage() {
  await requireUser()
  const sessions = await manageFetch<SessionInfo[]>('/profile/sessions')
  const now = currentTimeMs()

  const rows: SessionRow[] = []
  for (const session of sessions) {
    let ip = 'Unknown'
    if (session.ip) {
      ip = session.ip
    }
    let userAgent = ''
    if (session.user_agent) {
      userAgent = session.user_agent
    }
    let lastUsed = formatAgo(now - new Date(session.last_used_at).getTime())
    if (session.current) {
      lastUsed = 'Now'
    }
    rows.push({
      id: session.id,
      ip: ip,
      device: describeAgent(session.user_agent),
      userAgent: userAgent,
      lastUsed: lastUsed,
      current: session.current,
    })
  }

  return (
    <div className="manage-page">
      <header className="manage-page-header">
        <h1>Sessions</h1>
        <p>Every device that is signed in to your account. Log out the ones you don&apos;t recognise.</p>
      </header>
      <ProfileTabs active="/manage/profile/sessions" />
      <section className="manage-panel activity-panel">
        <SessionsTable sessions={rows} />
      </section>
    </div>
  )
}
