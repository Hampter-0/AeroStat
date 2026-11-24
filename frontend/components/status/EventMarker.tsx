import { AlertSmall, Check, Clock, Tool, X } from '@/components/icons'
import { incidentTone } from '@/lib/incidents'
import { maintenanceTone } from '@/lib/maintenance'

function incidentIcon(status: string) {
  if (status === 'resolved') {
    return <Check size={10} />
  }
  return <AlertSmall size={12} />
}

function maintenanceIcon(status: string) {
  if (status === 'in_progress') {
    return <Tool size={10} />
  } else if (status === 'completed') {
    return <Check size={10} />
  } else if (status === 'cancelled') {
    return <X size={10} />
  }
  return <Clock />
}

export function IncidentMarker({ status, severity }: { status: string; severity: string }) {
  return <span className={'event-marker tone-' + incidentTone(status, severity)}>{incidentIcon(status)}</span>
}

export function MaintenanceMarker({ status }: { status: string }) {
  return <span className={'event-marker tone-' + maintenanceTone(status)}>{maintenanceIcon(status)}</span>
}

export function IncidentIcon({ status, severity }: { status: string; severity: string }) {
  return <span className={'event-icon tone-' + incidentTone(status, severity)}>{incidentIcon(status)}</span>
}

export function MaintenanceIcon({ status }: { status: string }) {
  return <span className={'event-icon tone-' + maintenanceTone(status)}>{maintenanceIcon(status)}</span>
}
