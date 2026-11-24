export interface PanelNoticeSummary {
  unread: number
}

export interface PanelNotice {
  id: number
  kind: string
  title: string
  body: string
  tone: string
  path: string | null
  important: boolean
  created_at: string
}
