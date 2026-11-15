'use client'

import { useActionState } from 'react'
import type { FormState } from '@/app/manage/actions'
import { updateProfile } from '@/app/manage/(panel)/profile/actions'

const initialState: FormState = { error: null, success: null }

export default function AccountForm({ username, email }: { username: string; email: string | null }) {
  const [state, formAction, pending] = useActionState(updateProfile, initialState)

  let emailValue = ''
  if (email) {
    emailValue = email
  }

  let buttonText = 'Save'
  if (pending) {
    buttonText = 'Saving…'
  }

  return (
    <form action={formAction} className="manage-form">
      <div className="form-row">
        <label>
          <span>Username</span>
          <input
            key={'username-' + username}
            name="username"
            defaultValue={username}
            required
            minLength={2}
            maxLength={32}
            pattern="[a-zA-Z0-9._\-]+"
            autoComplete="username"
          />
        </label>
        <label>
          <span>Email</span>
          <input key={'email-' + emailValue} name="email" type="email" defaultValue={emailValue} autoComplete="email" placeholder="you@example.com" />
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
