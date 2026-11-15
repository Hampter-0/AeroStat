import { getAllMaintenance, getIncidents, getStatus } from './api'

export type OverallStatus = 'operational' | 'degraded' | 'outage' | 'maintenance' | 'no_services'

export type PublicServiceStatus = 'online' | 'offline' | 'pending'

export interface PublicService {
  id: string
  name: string
  group: string | null
  status: PublicServiceStatus
  last_checked: string | null
}

export interface PublicStatus {
  status: OverallStatus
  last_checked: string | null
  services: PublicService[]
  ongoing_incidents: { id: number; title: string; status: string; started_at: string }[]
  maintenance_in_progress: { id: number; title: string; ends_at: string }[]
}

export async function getPublicStatus(): Promise<PublicStatus> {
  const services = await getStatus()
  const incidents = await getIncidents()
  const maintenance = await getAllMaintenance()

  const publicServices: PublicService[] = []
  let lastChecked: string | null = null
  let anyOffline = false
  for (const service of services) {
    let status: PublicServiceStatus = 'pending'
    if (service.status === 'online') {
      status = 'online'
    } else if (service.status === 'offline') {
      status = 'offline'
      anyOffline = true
    }
    if (service.checked_at && (lastChecked === null || service.checked_at > lastChecked)) {
      lastChecked = service.checked_at
    }
    publicServices.push({
      id: service.id,
      name: service.name,
      group: service.group_name,
      status: status,
      last_checked: service.checked_at,
    })
  }

  const ongoingIncidents: PublicStatus['ongoing_incidents'] = []
  for (const incident of incidents) {
    if (incident.status !== 'resolved') {
      ongoingIncidents.push({ id: incident.id, title: incident.title, status: incident.status, started_at: incident.created_at })
    }
  }

  const maintenanceInProgress: PublicStatus['maintenance_in_progress'] = []
  for (const item of maintenance) {
    if (item.status === 'in_progress') {
      maintenanceInProgress.push({ id: item.id, title: item.title, ends_at: item.scheduled_end })
    }
  }

  let overall: OverallStatus = 'operational'
  if (services.length === 0) {
    overall = 'no_services'
  } else if (anyOffline) {
    overall = 'outage'
  } else if (ongoingIncidents.length > 0) {
    overall = 'degraded'
  } else if (maintenanceInProgress.length > 0) {
    overall = 'maintenance'
  }

  return {
    status: overall,
    last_checked: lastChecked,
    services: publicServices,
    ongoing_incidents: ongoingIncidents,
    maintenance_in_progress: maintenanceInProgress,
  }
}
