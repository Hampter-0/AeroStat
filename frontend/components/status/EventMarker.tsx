import StatusGlyph, { type GlyphKind } from '@/components/StatusGlyph'
import { incidentTone } from '@/lib/incidents'
import { maintenanceTone } from '@/lib/maintenance'

export function incidentGlyph(status: string): GlyphKind {
  if (status === 'resolved') {
    return 'check'
  }
  return 'alert'
}

export function maintenanceGlyph(status: string): GlyphKind {
  if (status === 'in_progress') {
    return 'wrench'
  } else if (status === 'completed') {
    return 'check'
  } else if (status === 'cancelled') {
    return 'x'
  }
  return 'clock'
}

export function IncidentMarker({ status, severity }: { status: string; severity: string }) {
  return (
    <span className={'event-marker tone-' + incidentTone(status, severity)}>
      <StatusGlyph kind={incidentGlyph(status)} size={24} />
    </span>
  )
}

export function MaintenanceMarker({ status }: { status: string }) {
  return (
    <span className={'event-marker tone-' + maintenanceTone(status)}>
      <StatusGlyph kind={maintenanceGlyph(status)} size={24} />
    </span>
  )
}

export function IncidentIcon({ status, severity }: { status: string; severity: string }) {
  return (
    <span className={'event-icon tone-' + incidentTone(status, severity)}>
      <StatusGlyph kind={incidentGlyph(status)} />
    </span>
  )
}

export function MaintenanceIcon({ status }: { status: string }) {
  return (
    <span className={'event-icon tone-' + maintenanceTone(status)}>
      <StatusGlyph kind={maintenanceGlyph(status)} />
    </span>
  )
}
