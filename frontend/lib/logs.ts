export interface LogLine {
  id: number
  time: string
  level: string
  target: string
  message: string
}

export interface LogsResponse {
  lines: LogLine[]
  matched: number
  capacity: number
}

export const LOG_LEVELS = [
  { id: 'all', label: 'All' },
  { id: 'info', label: 'Info and up' },
  { id: 'warn', label: 'Warnings' },
  { id: 'error', label: 'Errors' },
]

export function logsQuery(level: string, q: string): string {
  const params = new URLSearchParams({ level: level })
  if (q.trim() !== '') {
    params.set('q', q.trim())
  }
  return params.toString()
}
