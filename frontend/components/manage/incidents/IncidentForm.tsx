'use client'

import { useActionState, useState } from 'react'
import DateTimeField from '@/components/manage/DateTimeField'
import type { FormState } from '@/app/manage/actions'
import { createIncident, updateIncident } from '@/app/manage/(panel)/incidents/actions'
import ServicePicker, { type PickerService } from '@/components/manage/ServicePicker'
import { useResultToast } from '@/components/manage/toast/Toasts'
import { formatStatus } from '@/lib/format'
import { INCIDENT_SEVERITIES, INCIDENT_STATUSES, STATUS_HINTS } from '@/lib/incidents'
import { toInputValue, zoneAbbreviation } from '@/lib/time'
import { useFormSubmit, useKeepValuesSubmit } from '@/lib/use-form-submit'

const initialState: FormState = { error: null, success: null }

interface ExistingIncident {
  id: number
  title: string
  description: string | null
  severity: string
  affected_services: string[] | null
  created_at: string
  status: string
  resolved_at: string | null
}

export default function IncidentForm({
  services,
  incident,
  timezone,
  preselected = [],
}: {
  services: PickerService[]
  incident: ExistingIncident | null
  timezone: string
  preselected?: string[]
}) {
  let action = createIncident
  if (incident) {
    action = updateIncident
  }
  const [state, formAction, pending] = useActionState(action, initialState)
  useResultToast(state)
  const { formRef, onSubmit: submitAndReset } = useFormSubmit(formAction, state)
  const submitAndKeep = useKeepValuesSubmit(formAction)
  let onSubmit = submitAndReset
  let resetRef: typeof formRef | null = formRef
  if (incident) {
    onSubmit = submitAndKeep
    resetRef = null
  }
  const [status, setStatus] = useState('investigating')
  const [endedAt, setEndedAt] = useState('')

  function changeStatus(event: React.ChangeEvent<HTMLSelectElement>) {
    setStatus(event.target.value)
  }

  let title = ''
  let description = ''
  let severity = 'minor'
  let selected: string[] = preselected
  let startedAt = ''
  let resolvedAt = ''
  let incidentResolved = false
  if (incident) {
    title = incident.title
    if (incident.description) {
      description = incident.description
    }
    severity = incident.severity
    if (incident.affected_services) {
      selected = incident.affected_services
    }
    startedAt = toInputValue(incident.created_at, timezone)
    if (incident.status === 'resolved' && incident.resolved_at) {
      incidentResolved = true
      resolvedAt = toInputValue(incident.resolved_at, timezone)
    }
  }

  const zone = zoneAbbreviation(timezone)
  let resolved = false
  if (status === 'resolved' || endedAt !== '') {
    resolved = true
  }

  let buttonText = 'Create incident'
  if (incident) {
    buttonText = 'Save details'
  } else if (resolved) {
    buttonText = 'Add past incident'
  }
  if (pending) {
    buttonText = 'Saving…'
  }

  let messageLabel = 'First update'
  let messagePlaceholder = 'What is happening? This is shown on the status page.'
  if (resolved) {
    messageLabel = 'What happened'
    messagePlaceholder = 'What went wrong and how it was fixed. This is shown on the status page.'
  }

  let startHint = 'Leave empty if it started just now.'
  if (incident) {
    startHint = 'Can’t be later than the first update in the timeline.'
  }

  return (
    <form ref={resetRef} action={formAction} onSubmit={onSubmit} className="manage-form">
      {incident && <input type="hidden" name="id" value={incident.id} />}
      {incident && <input type="hidden" name="started_at_before" value={startedAt} />}
      {incidentResolved && <input type="hidden" name="resolved_at_before" value={resolvedAt} />}
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

      {!incident && endedAt === '' && (
        <label>
          <span>Status</span>
          <select name="status" value={status} onChange={changeStatus}>
            {INCIDENT_STATUSES.map(function (value) {
              return (
                <option value={value} key={value}>
                  {formatStatus(value)} — {STATUS_HINTS[value]}
                </option>
              )
            })}
          </select>
        </label>
      )}

      <div className="form-row">
        <label>
          <span>Started at ({zone})</span>
          <DateTimeField name="started_at" defaultValue={startedAt} required={Boolean(incident)} placeholder="Now" timezone={timezone} />
          <small className="field-hint">{startHint}</small>
        </label>
        {!incident && (
          <label>
            <span>Ended at ({zone})</span>
            <DateTimeField name="resolved_at" value={endedAt} onChange={setEndedAt} placeholder="Still going on" timezone={timezone} />
            <small className="field-hint">Leave empty if it is still going on.</small>
          </label>
        )}
        {incidentResolved && (
          <label>
            <span>Ended at ({zone})</span>
            <DateTimeField name="resolved_at" defaultValue={resolvedAt} required timezone={timezone} />
            <small className="field-hint">Moves the Resolved update in the timeline.</small>
          </label>
        )}
      </div>

      {!incident && resolved && (
        <p className="field-hint">A past incident goes straight into the history. Nobody gets a notification about it.</p>
      )}

      {!incident && (
        <label>
          <span>{messageLabel}</span>
          <textarea name="message" rows={3} required placeholder={messagePlaceholder} />
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
