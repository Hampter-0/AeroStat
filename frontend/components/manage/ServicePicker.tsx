'use client'

import { useState } from 'react'
import { groupServices, type PickerService } from '@/lib/affected'

export type { PickerService }

function GroupCheckbox({
  label,
  checked,
  mixed,
  onChange,
}: {
  label: string
  checked: boolean
  mixed: boolean
  onChange: (checked: boolean) => void
}) {
  function setMixed(input: HTMLInputElement | null) {
    if (input) {
      input.indeterminate = mixed
    }
  }

  function change(event: React.ChangeEvent<HTMLInputElement>) {
    onChange(event.target.checked)
  }

  return (
    <label className="check-row picker-whole">
      <input type="checkbox" ref={setMixed} checked={checked} onChange={change} />
      <span>{label}</span>
    </label>
  )
}

export default function ServicePicker({
  services,
  selected,
}: {
  services: PickerService[]
  selected: string[]
}) {
  const [chosen, setChosen] = useState<string[]>(selected)
  const groups = groupServices(services)

  function setMany(ids: string[], on: boolean) {
    let next = chosen.filter(function (id) {
      return !ids.includes(id)
    })
    if (on) {
      next = next.concat(ids)
    }
    setChosen(next)
  }

  function idsOf(list: PickerService[]): string[] {
    return list.map(function (service) {
      return service.id
    })
  }

  function countChosen(ids: string[]): number {
    let count = 0
    for (const id of ids) {
      if (chosen.includes(id)) {
        count = count + 1
      }
    }
    return count
  }

  const allIds = idsOf(services)
  const allCount = countChosen(allIds)

  return (
    <fieldset className="service-picker">
      <legend>Affected services</legend>
      {services.length > 1 && (
        <GroupCheckbox
          label="Select all"
          checked={allIds.length > 0 && allCount === allIds.length}
          mixed={allCount > 0 && allCount < allIds.length}
          onChange={function (on) {
            setMany(allIds, on)
          }}
        />
      )}
      {groups.map(function (group) {
        const ids = idsOf(group.services)
        const count = countChosen(ids)
        return (
          <div className="service-picker-group" key={group.name}>
            <GroupCheckbox
              label={group.name}
              checked={count === ids.length}
              mixed={count > 0 && count < ids.length}
              onChange={function (on) {
                setMany(ids, on)
              }}
            />
            <div className="permission-grid service-picker-children">
              {group.services.map(function (service) {
                return (
                  <label className="check-row" key={service.id}>
                    <input
                      type="checkbox"
                      name="affected_services"
                      value={service.id}
                      checked={chosen.includes(service.id)}
                      onChange={function (event) {
                        setMany([service.id], event.target.checked)
                      }}
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
