export interface ActivityEntry {
  id: number
  user_id: number | null
  username: string
  avatar_version: number | null
  category: string
  action: string
  target_id: string | null
  target_label: string | null
  ip: string | null
  details: unknown
  created_at: string
}

export interface ActivityResponse {
  entries: ActivityEntry[]
  total: number
  page: number
  per_page: number
}

export const ACTIVITY_CATEGORIES: { value: string; label: string; anyOf: string[] }[] = [
  { value: 'incidents', label: 'Incidents', anyOf: ['incidents.view'] },
  { value: 'maintenance', label: 'Maintenance', anyOf: ['maintenance.view'] },
  { value: 'services', label: 'Services', anyOf: ['services.view'] },
  { value: 'groups', label: 'Groups', anyOf: ['services.view'] },
  {
    value: 'settings',
    label: 'Settings',
    anyOf: ['settings.general', 'settings.appearance', 'settings.monitoring', 'settings.docker', 'settings.time', 'settings.notifications'],
  },
  { value: 'system', label: 'System', anyOf: ['system.view'] },
  { value: 'users', label: 'Users', anyOf: ['users.view'] },
  { value: 'roles', label: 'Roles', anyOf: ['roles.view'] },
  { value: 'account', label: 'Account', anyOf: ['users.view'] },
]

export const PER_PAGE_OPTIONS = [10, 25, 50, 100]
export const DEFAULT_PER_PAGE = 25

export function activityLink(entry: ActivityEntry): string | null {
  if (!entry.target_id) {
    return null
  }
  const id = encodeURIComponent(entry.target_id)
  if (entry.category === 'incidents') {
    return '/manage/incidents/' + id
  }
  if (entry.category === 'maintenance') {
    return '/manage/maintenance/' + id
  }
  if (entry.category === 'services') {
    return '/manage/services/' + id
  }
  return null
}

export interface ActivityQuery {
  category: string
  q: string
  perPage: number
  page: number
}

export function activityHref(query: ActivityQuery): string {
  const params = new URLSearchParams()
  if (query.category) {
    params.set('category', query.category)
  }
  if (query.q) {
    params.set('q', query.q)
  }
  if (query.perPage !== DEFAULT_PER_PAGE) {
    params.set('per_page', String(query.perPage))
  }
  if (query.page > 1) {
    params.set('page', String(query.page))
  }
  const text = params.toString()
  if (text) {
    return '/manage/activity?' + text
  }
  return '/manage/activity'
}
