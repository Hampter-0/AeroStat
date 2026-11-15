'use client'

import { useActionState, type ReactNode } from 'react'
import type { FormState } from '@/app/manage/actions'
import { saveSettings } from '@/app/manage/(panel)/settings/actions'
import { useFormSubmit } from '@/lib/use-form-submit'

const initialState: FormState = { error: null, success: null }

export default function SettingsForm({ children }: { children: ReactNode }) {
  const [state, formAction, pending] = useActionState(saveSettings, initialState)
  const { formRef, onSubmit } = useFormSubmit(formAction, state)

  let buttonText = 'Save'
  if (pending) {
    buttonText = 'Saving…'
  }

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className="manage-form">
      {children}
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
