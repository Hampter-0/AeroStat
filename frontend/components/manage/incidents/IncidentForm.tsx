'use client'

import { useActionState } from 'react'
import type { FormState } from '@/app/manage/actions'
import { createIncident, updateIncident } from '@/app/manage/(panel)/incidents/actions'
import ServicePicker, { type PickerService } from '@/components/manage/ServicePicker'
import { useResultToast } from '@/components/manage/toast/Toasts'
import { formatStatus } from '@/lib/format'
import { INCIDENT_SEVERITIES, INCIDENT_STATUSES, STATUS_HINTS } from '@/lib/incidents'
import { useFormSubmit } from '@/lib/use-form-submit'

const initialState: FormState = { error: null, success: null }

interface ExistingIncident {
  id: number
  title: string
  description: string | null
  severity: string
  affected_services: string[] | null
}

export default function IncidentForm({
  services,
  incident,
  preselected = [],
}: {
  services: PickerService[]
  incident: ExistingIncident | null
  preselected?: string[]
}) {
  let action = createIncident
  if (incident) {
    action = updateIncident
  }
  const [state, formAction, pending] = useActionState(action, initialState)
  useResultToast(state)
  const { formRef, onSubmit } = useFormSubmit(formAction, state)

  let title = ''
  let description = ''
  let severity = 'minor'
  let selected: string[] = preselected
  if (incident) {
    title = incident.title
    if (incident.description) {
      description = incident.description
    }
    severity = incident.severity
    if (incident.affected_services) {
      selected = incident.affected_services
    }
  }

  let buttonText = 'Create incident'
  if (incident) {
    buttonText = 'Save details'
  }
  if (pending) {
    buttonText = 'Saving…'
  }

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className="manage-form">
      {incident && <input type="hidden" name="id" value={incident.id} />}
      <label>
        <span>Title</span>
        <input name="title" defaultValue={title} required maxLength={200} placeholder="Short summary visitors will see" />
      </label>
      <label>
        <span>Description</span>
        <textarea name="description" defaultValue={description} rows={3} placeholder="Optional extra context" />
      </label>
      <label>
        <span>Severity</span>
        <select name="severity" defaultValue={severity}>
          {INCIDENT_SEVERITIES.map(function (value) {
            return (
              <option value={value} key={value}>
                {formatStatus(value)}
              </option>
            )
          })}
        </select>
      </label>
      <ServicePicker services={services} selected={selected} />

      {!incident && (
        <>
          <label>
            <span>Status</span>
            <select name="status" defaultValue="investigating">
              {INCIDENT_STATUSES.map(function (value) {
                return (
                  <option value={value} key={value}>
                    {formatStatus(value)} — {STATUS_HINTS[value]}
                  </option>
                )
              })}
            </select>
          </label>
          <label>
            <span>First update</span>
            <textarea name="message" rows={3} required placeholder="What is happening? This is shown on the status page." />
          </label>
        </>
      )}

      <div className="form-actions">
        <button type="submit" className="button-primary" disabled={pending}>
          {buttonText}
        </button>
      </div>
    </form>
  )
}
