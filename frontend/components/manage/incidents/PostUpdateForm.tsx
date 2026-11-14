'use client'

import { useActionState } from 'react'
import type { FormState } from '@/app/manage/actions'
import { postUpdate } from '@/app/manage/(panel)/incidents/actions'
import { formatStatus } from '@/lib/format'
import { INCIDENT_STATUSES, STATUS_HINTS } from '@/lib/incidents'

const initialState: FormState = { error: null, success: null }

export default function PostUpdateForm({ incidentId, currentStatus }: { incidentId: number; currentStatus: string }) {
  const [state, formAction, pending] = useActionState(postUpdate, initialState)

  let buttonText = 'Post update'
  if (pending) {
    buttonText = 'Posting…'
  }

  return (
    <form action={formAction} className="manage-form" key={currentStatus}>
      <input type="hidden" name="id" value={incidentId} />
      <div className="status-options" role="radiogroup" aria-label="Status">
        {INCIDENT_STATUSES.map(function (value) {
          return (
            <label className={'status-option status-' + value} key={value}>
              <input type="radio" name="status" value={value} defaultChecked={value === currentStatus} />
              <span>
                <strong>{formatStatus(value)}</strong>
                <small>{STATUS_HINTS[value]}</small>
              </span>
            </label>
          )
        })}
      </div>
      <label>
        <span>Message</span>
        <textarea name="message" rows={3} required placeholder="What changed? This is shown on the status page." />
      </label>
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
