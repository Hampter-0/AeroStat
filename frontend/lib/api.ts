import type { Incident, MaintenanceWindow, ServiceStatus, UptimeStats } from './types'

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
  } catch (error) {
    return names
  }
  return names
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

export async function getAllMaintenance(): Promise<MaintenanceWindow[]> {
  const res = await fetch(`${API_URL}/api/maintenance`, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Failed to fetch maintenance: ${res.status}`)
  }
  return res.json()
}