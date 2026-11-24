export interface PickerService {
  id: string
  name: string
  group_name: string | null
}

export interface ServiceGroup {
  name: string
  services: PickerService[]
}

export function groupServices(services: PickerService[]): ServiceGroup[] {
  const groups: ServiceGroup[] = []
  for (const service of services) {
    let name = 'Other'
    if (service.group_name) {
      name = service.group_name
    }
    let group = groups.find(function (item) {
      return item.name === name
    })
    if (!group) {
      group = { name: name, services: [] }
      groups.push(group)
    }
    group.services.push(service)
  }
  return groups
}

export function affectedLabels(affected: string[], services: PickerService[]): string[] {
  const known = services.filter(function (service) {
    return affected.includes(service.id)
  })
  if (services.length > 1 && known.length === services.length) {
    return ['All']
  }

  const labels: string[] = []
  for (const group of groupServices(services)) {
    const hit = group.services.filter(function (service) {
      return affected.includes(service.id)
    })
    if (hit.length === 0) {
      continue
    }
    if (group.services.length > 1 && hit.length === group.services.length) {
      labels.push(group.name)
    } else {
      for (const service of hit) {
        labels.push(service.name)
      }
    }
  }
  return labels
}
