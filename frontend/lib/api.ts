import type { Incident, IncidentDetail, MaintenanceDetail, MaintenanceWindow, ResponseTimes, ServiceStatus, UptimeHistory, UptimeStats } from './types'
import { affectedLabels } from './affected'

const API_URL = process.env.API_URL

export async function getStatus(): Promise<ServiceStatus[]> {
  const res = await fetch(`${API_URL}/api/status`, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Failed to fetch status: ${res.status}`)
  }
  return res.json()
}

export async function getServiceNames(): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  try {
    const services = await getStatus()
    for (const service of services) {
      names.set(service.id, service.name)
    }
  } catch {
    return names
  }
  return names
}

export async function getUptimeHistory(serviceId: string, page: number): Promise<UptimeHistory | null> {
  try {
    const res = await fetch(`${API_URL}/api/uptime/${encodeURIComponent(serviceId)}/history?page=${page}`, { cache: 'no-store' })
    if (!res.ok) {
      return null
    }
    return res.json()
  } catch {
    return null
  }
}

export async function getResponseTimes(range: string, service: string): Promise<ResponseTimes | null> {
  const params = new URLSearchParams({ range: range })
  if (service) {
    params.set('service', service)
  }
  try {
    const res = await fetch(`${API_URL}/api/response-times?` + params.toString(), { cache: 'no-store' })
    if (!res.ok) {
      return null
    }
    return res.json()
  } catch {
    return null
  }
}

export async function getAffectedLabeler(): Promise<(affected: string[] | null) => string[]> {
  let services: ServiceStatus[] = []
  try {
    services = await getStatus()
  } catch {
    services = []
  }
  return function (affected: string[] | null) {
    if (!affected || affected.length === 0) {
      return []
    }
    return affectedLabels(affected, services)
  }
}

export async function getAffectedLabels(affected: string[] | null): Promise<string[]> {
  if (!affected || affected.length === 0) {
    return []
  }
  try {
    const services = await getStatus()
    return affectedLabels(affected, services)
  } catch {
    return []
  }
}

export async function getUpcomingMaintenance(): Promise<MaintenanceWindow[]> {
  const res = await fetch(`${API_URL}/api/maintenance`, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Failed to fetch maintenance: ${res.status}`)
  }
  return res.json()
}

export async function getUptime(serviceId: string): Promise<UptimeStats> {
  const res = await fetch(`${API_URL}/api/uptime/${serviceId}`, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Failed to fetch uptime for ${serviceId}: ${res.status}`)
  }
  return res.json()
}

export async function getIncidents(): Promise<Incident[]> {
  const res = await fetch(`${API_URL}/api/incidents`, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Failed to fetch incidents: ${res.status}`)
  }
  return res.json()
}

export async function getIncidentsBetween(fromIso: string, toIso: string): Promise<Incident[]> {
  const params = new URLSearchParams({ from: fromIso, to: toIso, limit: '500' })
  const res = await fetch(`${API_URL}/api/incidents?` + params.toString(), { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Failed to fetch incidents: ${res.status}`)
  }
  return res.json()
}

export async function hasIncidentsBefore(iso: string): Promise<boolean> {
  const params = new URLSearchParams({ to: iso, limit: '1' })
  const res = await fetch(`${API_URL}/api/incidents?` + params.toString(), { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Failed to fetch incidents: ${res.status}`)
  }
  const rows: Incident[] = await res.json()
  return rows.length > 0
}

export async function getAllMaintenance(): Promise<MaintenanceWindow[]> {
  const res = await fetch(`${API_URL}/api/maintenance`, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Failed to fetch maintenance: ${res.status}`)
  }
  return res.json()
}
export async function getIncident(id: string): Promise<IncidentDetail | null> {
  const res = await fetch(`${API_URL}/api/incidents/${encodeURIComponent(id)}`, { cache: 'no-store' })
  if (res.status === 404 || res.status === 400) {
    return null
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch incident ${id}: ${res.status}`)
  }
  return res.json()
}

export async function getMaintenance(id: string): Promise<MaintenanceDetail | null> {
  const res = await fetch(`${API_URL}/api/maintenance/${encodeURIComponent(id)}`, { cache: 'no-store' })
  if (res.status === 404 || res.status === 400) {
    return null
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch maintenance ${id}: ${res.status}`)
  }
  return res.json()
}
