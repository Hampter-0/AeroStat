export interface PickerService {
  id: string
  name: string
  group_name: string | null
}

export default function ServicePicker({
  services,
  selected,
}: {
  services: PickerService[]
  selected: string[]
}) {
  const groups = new Map<string, PickerService[]>()
  for (const service of services) {
    let groupName = 'Other'
    if (service.group_name) {
      groupName = service.group_name
    }
    if (!groups.has(groupName)) {
      groups.set(groupName, [])
    }
    groups.get(groupName)!.push(service)
  }

  return (
    <fieldset className="service-picker">
      <legend>Affected services</legend>
      {Array.from(groups.entries()).map(function (entry) {
        return (
          <div className="service-picker-group" key={entry[0]}>
            <span>{entry[0]}</span>
            <div className="permission-grid">
              {entry[1].map(function (service) {
                return (
                  <label className="check-row" key={service.id}>
                    <input
                      type="checkbox"
                      name="affected_services"
                      value={service.id}
                      defaultChecked={selected.includes(service.id)}
                    />
                    <span>{service.name}</span>
                  </label>
                )
              })}
            </div>
          </div>
        )
      })}
    </fieldset>
  )
}
