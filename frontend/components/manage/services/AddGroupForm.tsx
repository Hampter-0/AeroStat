'use client'

import { useActionState } from 'react'
import type { FormState } from '@/app/manage/actions'
import { createGroup } from '@/app/manage/(panel)/services/actions'
import { useResultToast } from '@/components/manage/toast/Toasts'
import { useFormSubmit } from '@/lib/use-form-submit'

const initialState: FormState = { error: null, success: null }

export default function AddGroupForm() {
  const [state, formAction, pending] = useActionState(createGroup, initialState)
  useResultToast(state)
  const { formRef, onSubmit } = useFormSubmit(formAction, state)

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className="manage-form">
      <div className="inline-form">
        <input name="name" required maxLength={100} placeholder="Group name, e.g. Websites" aria-label="Group name" />
        <button type="submit" className="button-primary" disabled={pending}>
          Add group
        </button>
      </div>
    </form>
  )
}
