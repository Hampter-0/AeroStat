'use client'

import { useActionState } from 'react'
import type { FormState } from '@/app/manage/actions'
import { createService, updateService } from '@/app/manage/(panel)/services/actions'
import { INTERVAL_UNITS, splitInterval, type ManageGroup, type ManageService } from '@/lib/services'
import { useFormSubmit } from '@/lib/use-form-submit'

const initialState: FormState = { error: null, success: null }

export default function ServiceForm({
  groups,
  service,
  defaultGroupId,
}: {
  groups: ManageGroup[]
  service: ManageService | null
  defaultGroupId: string
}) {
  let action = createService
  if (service) {
    action = updateService
  }
  const [state, formAction, pending] = useActionState(action, initialState)
  const { formRef, onSubmit } = useFormSubmit(formAction, state)

  let name = ''
  let url = ''
  let groupId = defaultGroupId
  let statuses = '200'
  let interval = 300
  if (service) {
    name = service.name
    url = service.url
    groupId = ''
    if (service.group_id) {
      groupId = service.group_id
    }
    statuses = service.expected_status.join(', ')
    interval = service.check_interval_seconds
  }

  const intervalParts = splitInterval(interval)

  let buttonText = 'Add service'
  if (service) {
    buttonText = 'Save changes'
  }
  if (pending) {
    buttonText = 'Saving…'
  }

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className="manage-form">
      {service && <input type="hidden" name="id" value={service.id} />}
      <div className="form-row">
        <label>
          <span>Name</span>
          <input name="name" defaultValue={name} required maxLength={100} placeholder="e.g. Website" />
        </label>
        <label>
          <span>Group</span>
          <select name="group_id" defaultValue={groupId}>
            <option value="">No group (shown under Other)</option>
            {groups.map(function (group) {
              return (
                <option value={group.id} key={group.id}>
                  {group.name}
                </option>
              )
            })}
          </select>
        </label>
      </div>
      <label>
        <span>URL to check</span>
        <input name="url" type="url" defaultValue={url} required placeholder="https://example.com/health" />
      </label>
      <div className="form-row">
        <label>
          <span>Expected status codes</span>
          <input name="expected_status" defaultValue={statuses} required placeholder="200, 204" />
          <small className="field-hint">Separate with commas. Any other code counts as down.</small>
        </label>
        <label>
          <span>Check every</span>
          <div className="interval-field">
            <input
              name="interval_amount"
              type="number"
              min={1}
              step={1}
              required
              defaultValue={intervalParts.amount}
              aria-label="Interval amount"
            />
            <select name="interval_unit" defaultValue={intervalParts.unit} aria-label="Interval unit">
              {INTERVAL_UNITS.map(function (unit) {
                return (
                  <option value={unit.value} key={unit.value}>
                    {unit.label}
                  </option>
                )
              })}
            </select>
          </div>
          <small className="field-hint">Between 30 seconds and 24 hours.</small>
        </label>
      </div>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      {state.success && <p className="form-success" role="status">{state.success}</p>}
      <div className="form-actions">
        <button type="submit" className="button-primary" disabled={pending}>
          {buttonText}
        </button>
      </div>
    </form>
  )
}
