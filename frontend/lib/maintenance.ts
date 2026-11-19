export const MAINTENANCE_UPDATE_STATUSES = ['scheduled', 'in_progress', 'completed']

export const MAINTENANCE_HINTS: Record<string, string> = {
  scheduled: 'Planned, not started yet',
  in_progress: 'Work is happening now',
  completed: 'Work is done, ends it now',
  cancelled: 'Not going ahead',
}

export function maintenanceTone(status: string): string {
  if (status === 'completed') {
    return 'green'
  }
  if (status === 'cancelled') {
    return 'gray'
  }
  return 'blue'
}
