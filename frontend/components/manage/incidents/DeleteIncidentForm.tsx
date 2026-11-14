'use client'

import { useActionState } from 'react'
import type { FormState } from '@/app/manage/actions'
import { deleteIncident } from '@/app/manage/(panel)/incidents/actions'

const initialState: FormState = { error: null, success: null }

export default function DeleteIncidentForm({ incidentId }: { incidentId: number }) {
  const [state, formAction, pending] = useActionState(deleteIncident, initialState)

  function confirmDelete(event: React.FormEvent<HTMLFormElement>) {
    if (!window.confirm('Delete this incident and all its updates? This removes it from the status page and cannot be undone.')) {
      event.preventDefault()
    }
  }

  return (
    <form action={formAction} onSubmit={confirmDelete} className="danger-zone">
      <input type="hidden" name="id" value={incidentId} />
      <p>Deleting removes the incident and its whole timeline from the status page.</p>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <button type="submit" className="button-danger" disabled={pending}>
        Delete incident
      </button>
    </form>
  )
}
