export const INCIDENT_STATUSES = ['investigating', 'identified', 'monitoring', 'resolved']

export const INCIDENT_SEVERITIES = ['minor', 'major', 'critical']

export const STATUS_HINTS: Record<string, string> = {
  investigating: 'We are looking into it',
  identified: 'We know the cause',
  monitoring: 'A fix is out, we are watching',
  resolved: 'Everything is back to normal',
}
