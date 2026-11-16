'use client'

import { useActionState } from 'react'
import { createUser, type FormState } from '@/app/manage/actions'
import PermissionFields from './PermissionFields'
import { useFormSubmit } from '@/lib/use-form-submit'

const initialState: FormState = { error: null, success: null }

export default function NewUserForm({ permissions }: { permissions: string[] }) {
  const [state, formAction, pending] = useActionState(createUser, initialState)
  const { formRef, onSubmit } = useFormSubmit(formAction, state)
  let buttonText = 'Add user'
  if (pending) {
    buttonText = 'Adding…'
  }

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className="manage-form">
      <div className="form-row">
        <label>
          <span>Username</span>
          <input name="username" autoComplete="off" required minLength={2} maxLength={32} pattern="[a-zA-Z0-9._\-]+" />
        </label>
        <label>
          <span>Password</span>
          <input name="password" type="password" autoComplete="new-password" required minLength={8} />
        </label>
      </div>
      <label>
        <span>Email</span>
        <input name="email" type="email" autoComplete="off" placeholder="Optional" />
        <small className="field-hint">For email notifications. They can change it on their profile.</small>
      </label>
      <PermissionFields permissions={permissions} initialAdmin={false} initialSelected={[]} adminLocked={false} />
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
