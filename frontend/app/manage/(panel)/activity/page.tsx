import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Search } from '@/components/icons'
import Avatar from '@/components/manage/Avatar'
import ActivityDetails from '@/components/manage/activity/ActivityDetails'
import Pagination from '@/components/manage/activity/Pagination'
import PerPageSelect from '@/components/manage/activity/PerPageSelect'
import {
  ACTIVITY_CATEGORIES,
  DEFAULT_PER_PAGE,
  PER_PAGE_OPTIONS,
  activityHref,
  activityLink,
  type ActivityQuery,
  type ActivityResponse,
} from '@/lib/activity'
import { getSiteConfig } from '@/lib/branding'
import { can, manageFetch, requireUser } from '@/lib/manage'
import { formatDateTimeShort } from '@/lib/time'

export const metadata = {
  title: 'Activity',
}

interface SearchParams {
  category?: string
  q?: string
  per_page?: string
  page?: string
}

function readQuery(params: SearchParams): ActivityQuery {
  let category = ''
  for (const item of ACTIVITY_CATEGORIES) {
    if (item.value === params.category) {
      category = item.value
    }
  }

  let perPage = DEFAULT_PER_PAGE
  const wantedPerPage = Number(params.per_page)
  if (PER_PAGE_OPTIONS.includes(wantedPerPage)) {
    perPage = wantedPerPage
  }

  let page = 1
  if (params.page && /^\d+$/.test(params.page) && Number(params.page) > 0) {
    page = Number(params.page)
  }

  let q = ''
  if (params.q) {
    q = params.q.trim().slice(0, 100)
  }

  return { category: category, q: q, perPage: perPage, page: page }
}

export default async function ActivityPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser()
  if (!can(user, 'activity.view')) {
    redirect('/manage')
  }
  const { timezone } = await getSiteConfig()
  const query = readQuery(await searchParams)

  const apiParams = new URLSearchParams({ page: String(query.page), per_page: String(query.perPage) })
  if (query.category) {
    apiParams.set('category', query.category)
  }
  if (query.q) {
    apiParams.set('q', query.q)
  }
  const data = await manageFetch<ActivityResponse>('/activity?' + apiParams.toString())

  const lastPage = Math.max(1, Math.ceil(data.total / query.perPage))
  if (query.page > lastPage) {
    redirect(activityHref({ ...query, page: lastPage }))
  }

  let summaryText = 'No results.'
  if (data.total > 0) {
    const first = (query.page - 1) * query.perPage + 1
    const last = first + data.entries.length - 1
    summaryText = 'Showing ' + first + ' to ' + last + ' of ' + data.total + ' results.'
  }

  const bar = (
    <div className="activity-bar">
      <p>{summaryText}</p>
      <div className="activity-bar-controls">
        <PerPageSelect query={query} />
        <Pagination query={query} lastPage={lastPage} />
      </div>
    </div>
  )

  let allClass = 'activity-filter'
  let allCurrent: 'page' | undefined = undefined
  if (query.category === '') {
    allClass = 'activity-filter active'
    allCurrent = 'page'
  }

  return (
    <div className="manage-page">
      <header className="manage-page-header activity-header">
        <div>
          <h1>Activity</h1>
          <p>Who changed what in the panel, kept for a year.</p>
        </div>
        <form className="activity-search" action="/manage/activity" role="search">
          {query.category && <input type="hidden" name="category" value={query.category} />}
          {query.perPage !== DEFAULT_PER_PAGE && <input type="hidden" name="per_page" value={query.perPage} />}
          <Search />
          <input type="search" name="q" defaultValue={query.q} key={query.q} placeholder="Search…" aria-label="Search activity" maxLength={100} />
        </form>
      </header>

      <nav className="activity-filters" aria-label="Filter activity">
        <Link href={activityHref({ ...query, category: '', page: 1 })} className={allClass} aria-current={allCurrent}>
          All
        </Link>
        {ACTIVITY_CATEGORIES.map(function (item) {
          let itemClass = 'activity-filter'
          let current: 'page' | undefined = undefined
          if (item.value === query.category) {
            itemClass = 'activity-filter active'
            current = 'page'
          }
          return (
            <Link
              href={activityHref({ ...query, category: item.value, page: 1 })}
              className={itemClass}
              aria-current={current}
              key={item.value}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      <section className="manage-panel activity-panel">
        {bar}
        {data.entries.length === 0 && <p className="manage-empty activity-empty">No activity found.</p>}
        {data.entries.length > 0 && (
          <div className="activity-table-wrap">
            <table className="activity-table">
              <thead>
                <tr>
                  <th className="activity-avatar-cell">
                    <span className="sr-only">Avatar</span>
                  </th>
                  <th>Actor</th>
                  <th>Event</th>
                  <th className="activity-ip-cell">IP</th>
                  <th>When</th>
                  <th>
                    <span className="sr-only">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map(function (entry) {
                  const href = activityLink(entry)
                  let target = null
                  if (entry.target_label && href) {
                    target = <Link href={href}>{entry.target_label}</Link>
                  } else if (entry.target_label) {
                    target = <strong>{entry.target_label}</strong>
                  }

                  let summary = entry.username + ' ' + entry.action
                  if (entry.target_label) {
                    summary = summary + ' ' + entry.target_label
                  }

                  return (
                    <tr key={entry.id}>
                      <td className="activity-avatar-cell">
                        <Avatar userId={entry.user_id || 0} username={entry.username} version={entry.avatar_version} size={26} />
                      </td>
                      <td className="activity-actor">{entry.username}</td>
                      <td className="activity-event">
                        {entry.action} {target}
                      </td>
                      <td className="activity-ip-cell">{entry.ip && <code>{entry.ip}</code>}</td>
                      <td className="activity-when">
                        <time dateTime={entry.created_at}>{formatDateTimeShort(entry.created_at, timezone)}</time>
                      </td>
                      <td className="activity-details-cell">
                        {entry.details !== null && <ActivityDetails details={entry.details} summary={summary} />}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {data.entries.length > 0 && bar}
      </section>
    </div>
  )
}
