'use client'

import { useActionState } from 'react'
import type { FormState } from '@/app/manage/actions'

const initialState: FormState = { error: null, success: null }

export default function DeleteForm({
  id,
  action,
  buttonText,
  description,
  confirmText,
}: {
  id: number
  action: (state: FormState, formData: FormData) => Promise<FormState>
  buttonText: string
  description: string
  confirmText: string
}) {
  const [state, formAction, pending] = useActionState(action, initialState)

  function confirmDelete(event: React.FormEvent<HTMLFormElement>) {
    if (!window.confirm(confirmText)) {
      event.preventDefault()
    }
  }

  return (
    <form action={formAction} onSubmit={confirmDelete} className="danger-zone">
      <input type="hidden" name="id" value={id} />
      <p>{description}</p>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <button type="submit" className="button-danger" disabled={pending}>
        {buttonText}
      </button>
    </form>
  )
}
