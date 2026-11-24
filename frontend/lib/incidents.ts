export const INCIDENT_STATUSES = ['investigating', 'identified', 'monitoring', 'resolved']

export const INCIDENT_SEVERITIES = ['minor', 'major', 'critical']

export const STATUS_HINTS: Record<string, string> = {
  investigating: 'We are looking into it',
  identified: 'We know the cause',
  monitoring: 'A fix is out, we are watching',
  resolved: 'Everything is back to normal',
}

export function incidentTone(status: string, severity: string): string {
  if (status === 'resolved') {
    return 'green'
  }
  if (severity === 'critical') {
    return 'red'
  }
  return 'amber'
}

export function updateTone(status: string): string {
  if (status === 'resolved' || status === 'completed') {
    return 'green'
  }
  if (status === 'scheduled') {
    return 'amber'
  }
  if (status === 'in_progress') {
    return 'blue'
  }
  return 'gray'
}
