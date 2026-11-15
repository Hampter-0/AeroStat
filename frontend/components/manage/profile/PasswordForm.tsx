'use client'

import { useActionState } from 'react'
import type { FormState } from '@/app/manage/actions'
import { changePassword } from '@/app/manage/(panel)/profile/actions'

const initialState: FormState = { error: null, success: null }

export default function PasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, initialState)

  let buttonText = 'Change password'
  if (pending) {
    buttonText = 'Changing…'
  }

  return (
    <form action={formAction} className="manage-form">
      <label>
        <span>Current password</span>
        <input name="current_password" type="password" autoComplete="current-password" required />
      </label>
      <div className="form-row">
        <label>
          <span>New password</span>
          <input name="new_password" type="password" autoComplete="new-password" required minLength={8} />
          <small className="field-hint">At least 8 characters.</small>
        </label>
        <label>
          <span>Repeat new password</span>
          <input name="repeat_password" type="password" autoComplete="new-password" required minLength={8} />
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
