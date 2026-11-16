export type BackupKind = 'manual' | 'scheduled' | 'update' | 'restore' | 'upload'

export interface Backup {
  id: string
  created_at: string
  version: string
  kind: BackupKind
  created_by: string | null
  size_bytes: number
  note: string | null
}

export interface BackupsView {
  backups: Backup[]
  tool: string | null
  dir: string | null
  total_bytes: number
  settings: { schedule: string; keep: number; before_update: boolean }
  version: string
  in_docker: boolean
}

export const KIND_LABELS: Record<BackupKind, string> = {
  manual: 'Manual',
  scheduled: 'Scheduled',
  update: 'Before update',
  restore: 'Before restore',
  upload: 'Uploaded',
}
