'use client'

import { useActionState } from 'react'
import type { FormState } from '@/app/manage/actions'
import { createGroup } from '@/app/manage/(panel)/services/actions'

const initialState: FormState = { error: null, success: null }

export default function AddGroupForm() {
  const [state, formAction, pending] = useActionState(createGroup, initialState)

  return (
    <form action={formAction} className="manage-form">
      <div className="inline-form">
        <input name="name" required maxLength={100} placeholder="Group name, e.g. Websites" aria-label="Group name" />
        <button type="submit" className="button-primary" disabled={pending}>
          Add group
        </button>
      </div>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      {state.success && <p className="form-success" role="status">{state.success}</p>}
    </form>
  )
}
