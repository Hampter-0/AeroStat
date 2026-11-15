'use client'

import { useActionState } from 'react'
import type { FormState } from '@/app/manage/actions'
import { sendTestEmail } from '@/app/manage/(panel)/settings/actions'

const initialState: FormState = { error: null, success: null }

export default function EmailTest({ defaultTo }: { defaultTo: string }) {
  const [state, formAction, pending] = useActionState(sendTestEmail, initialState)

  let buttonText = 'Send'
  if (pending) {
    buttonText = 'Sending…'
  }

  return (
    <form action={formAction} className="email-test">
      <div className="inline-form">
        <input
          name="to"
          type="email"
          required
          defaultValue={defaultTo}
          placeholder="you@example.com"
          aria-label="Send the test email to"
        />
        <button type="submit" className="button-primary" disabled={pending}>
          {buttonText}
        </button>
      </div>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      {state.success && <p className="form-success" role="status">{state.success}</p>}
    </form>
  )
}
