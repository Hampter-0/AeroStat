import { getAllMaintenance, getIncidents, getStatus } from './api'

export type OverallStatus = 'operational' | 'degraded' | 'outage' | 'maintenance' | 'no_services'

export type PublicServiceStatus = 'online' | 'offline' | 'pending'

export interface PublicService {
  id: string
  name: string
  group: string | null
  status: PublicServiceStatus
  slow: boolean
  last_checked: string | null
}

export interface PublicIncident {
  id: number
  title: string
  status: string
  started_at: string
  services: string[]
}

export interface PublicMaintenance {
  id: number
  title: string
  ends_at: string
  services: string[]
}

export interface PublicStatus {
  status: OverallStatus
  last_checked: string | null
  services: PublicService[]
  ongoing_incidents: PublicIncident[]
  maintenance_in_progress: PublicMaintenance[]
}

export interface PublicServiceDetail extends PublicService {
  ongoing_incidents: PublicIncident[]
  maintenance_in_progress: PublicMaintenance[]
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
      slow: typeof service.slow_ms === 'number',
      last_checked: service.checked_at,
    })
  }

  const ongoingIncidents: PublicIncident[] = []
  for (const incident of incidents) {
    if (incident.status !== 'resolved') {
      ongoingIncidents.push({
        id: incident.id,
        title: incident.title,
        status: incident.status,
        started_at: incident.created_at,
        services: incident.affected_services || [],
      })
    }
  }

  const maintenanceInProgress: PublicMaintenance[] = []
  for (const item of maintenance) {
    if (item.status === 'in_progress') {
      maintenanceInProgress.push({
        id: item.id,
        title: item.title,
        ends_at: item.scheduled_end,
        services: item.affected_services || [],
      })
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

/** One service with only the incidents and maintenance that affect it. */
export function serviceDetail(status: PublicStatus, serviceId: string): PublicServiceDetail | null {
  const service = status.services.find(function (item) {
    return item.id === serviceId
  })
  if (!service) {
    return null
  }
  return {
    ...service,
    ongoing_incidents: status.ongoing_incidents.filter(function (incident) {
      return incident.services.includes(serviceId)
    }),
    maintenance_in_progress: status.maintenance_in_progress.filter(function (item) {
      return item.services.includes(serviceId)
    }),
  }
}
