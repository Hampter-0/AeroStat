'use client'

import { useActionState } from 'react'
import DateTimeField from '@/components/manage/DateTimeField'
import type { FormState } from '@/app/manage/actions'
import { createMaintenance, updateMaintenance } from '@/app/manage/(panel)/maintenance/actions'
import ServicePicker, { type PickerService } from '@/components/manage/ServicePicker'
import { useResultToast } from '@/components/manage/toast/Toasts'
import { toInputValue, zoneAbbreviation } from '@/lib/time'
import { useFormSubmit, useKeepValuesSubmit } from '@/lib/use-form-submit'

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
  useResultToast(state)
  const { formRef, onSubmit: submitAndReset } = useFormSubmit(formAction, state)
  const submitAndKeep = useKeepValuesSubmit(formAction)
  let onSubmit = submitAndReset
  let resetRef: typeof formRef | null = formRef
  if (maintenance) {
    onSubmit = submitAndKeep
    resetRef = null
  }

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
    <form ref={resetRef} action={formAction} onSubmit={onSubmit} className="manage-form">
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
          <DateTimeField name="scheduled_start" defaultValue={start} required timezone={timezone} />
        </label>
        <label>
          <span>End ({zoneAbbreviation(timezone)})</span>
          <DateTimeField name="scheduled_end" defaultValue={end} required timezone={timezone} />
        </label>
      </div>
      <ServicePicker services={services} selected={selected} />

      {!maintenance && (
        <label>
          <span>First update</span>
          <textarea name="message" rows={2} placeholder="Optional. Defaults to “Maintenance has been scheduled.”" />
        </label>
      )}

      <div className="form-actions">
        <button type="submit" className="button-primary" disabled={pending}>
          {buttonText}
        </button>
      </div>
    </form>
  )
}
