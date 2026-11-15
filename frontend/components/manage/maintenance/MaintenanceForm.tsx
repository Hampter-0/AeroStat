'use client'

import { useActionState } from 'react'
import type { FormState } from '@/app/manage/actions'
import { createMaintenance, updateMaintenance } from '@/app/manage/(panel)/maintenance/actions'
import ServicePicker, { type PickerService } from '@/components/manage/ServicePicker'
import { toInputValue, zoneAbbreviation } from '@/lib/time'
import { useFormSubmit } from '@/lib/use-form-submit'

const initialState: FormState = { error: null, success: null }

interface ExistingMaintenance {
  id: number
  title: string
  description: string | null
  affected_services: string[] | null
  scheduled_start: string
  scheduled_end: string
}

export default function MaintenanceForm({
  services,
  maintenance,
  timezone,
}: {
  services: PickerService[]
  maintenance: ExistingMaintenance | null
  timezone: string
}) {
  let action = createMaintenance
  if (maintenance) {
    action = updateMaintenance
  }
  const [state, formAction, pending] = useActionState(action, initialState)
  const { formRef, onSubmit } = useFormSubmit(formAction, state)

  let title = ''
  let description = ''
  let selected: string[] = []
  let start = ''
  let end = ''
  if (maintenance) {
    title = maintenance.title
    if (maintenance.description) {
      description = maintenance.description
    }
    if (maintenance.affected_services) {
      selected = maintenance.affected_services
    }
    start = toInputValue(maintenance.scheduled_start, timezone)
    end = toInputValue(maintenance.scheduled_end, timezone)
  }

  let buttonText = 'Schedule maintenance'
  if (maintenance) {
    buttonText = 'Save details'
  }
  if (pending) {
    buttonText = 'Saving…'
  }

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className="manage-form">
      {maintenance && <input type="hidden" name="id" value={maintenance.id} />}
      <label>
        <span>Title</span>
        <input name="title" defaultValue={title} required maxLength={200} placeholder="What is being worked on" />
      </label>
      <label>
        <span>Description</span>
        <textarea name="description" defaultValue={description} rows={3} placeholder="What visitors can expect, for example short interruptions" />
      </label>
      <div className="form-row">
        <label>
          <span>Start ({zoneAbbreviation(timezone)})</span>
          <input name="scheduled_start" type="datetime-local" defaultValue={start} required />
        </label>
        <label>
          <span>End ({zoneAbbreviation(timezone)})</span>
          <input name="scheduled_end" type="datetime-local" defaultValue={end} required />
        </label>
      </div>
      <ServicePicker services={services} selected={selected} />

      {!maintenance && (
        <label>
          <span>First update</span>
          <textarea name="message" rows={2} placeholder="Optional. Defaults to “Maintenance has been scheduled.”" />
        </label>
      )}

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
