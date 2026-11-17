export interface BellSummary {
  unread: number
  unread_important: number
  muted_until: string | null
}

export interface BellItem {
  id: number
  kind: string
  title: string
  body: string
  tone: string
  path: string | null
  important: boolean
  read: boolean
  created_at: string
}

export interface BellPage extends BellSummary {
  items: BellItem[]
  next_before: number | null
}

export const BELL_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'important', label: 'Important' },
]

export const MUTE_CHOICES = [
  { label: '1 hour', hours: 1 },
  { label: '8 hours', hours: 8 },
  { label: '24 hours', hours: 24 },
]
