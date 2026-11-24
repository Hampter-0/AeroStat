import { AlertSmall, Check, Clock, Tool, X } from '@/components/icons'
import { incidentTone } from '@/lib/incidents'
import { maintenanceTone } from '@/lib/maintenance'

export function IncidentMarker({ status, severity }: { status: string; severity: string }) {
  let icon = <AlertSmall size={12} />
  if (status === 'resolved') {
    icon = <Check size={10} />
  }
  return <span className={'event-marker tone-' + incidentTone(status, severity)}>{icon}</span>
}

export function MaintenanceMarker({ status }: { status: string }) {
  let icon = <Clock />
  if (status === 'in_progress') {
    icon = <Tool size={10} />
  } else if (status === 'completed') {
    icon = <Check size={10} />
  } else if (status === 'cancelled') {
    icon = <X size={10} />
  }
  return <span className={'event-marker tone-' + maintenanceTone(status)}>{icon}</span>
}
