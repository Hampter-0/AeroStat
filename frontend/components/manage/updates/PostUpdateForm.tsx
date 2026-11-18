'use client'

import { useActionState } from 'react'
import type { FormState } from '@/app/manage/actions'
import { useResultToast } from '@/components/manage/toast/Toasts'
import { formatStatus } from '@/lib/format'
import { zoneAbbreviation } from '@/lib/time'
import { useFormSubmit } from '@/lib/use-form-submit'

const initialState: FormState = { error: null, success: null }

export default function PostUpdateForm({
  parentId,
  currentStatus,
  statuses,
  hints,
  action,
  timezone = null,
}: {
  parentId: number
  currentStatus: string
  statuses: string[]
  hints: Record<string, string>
  action: (state: FormState, formData: FormData) => Promise<FormState>
  timezone?: string | null
}) {
  const [state, formAction, pending] = useActionState(action, initialState)
  useResultToast(state)
  const { formRef, onSubmit } = useFormSubmit(formAction, state)

  let buttonText = 'Post update'
  if (pending) {
    buttonText = 'Posting…'
  }

  let columnsClass = 'status-options'
  if (statuses.length === 3) {
    columnsClass = 'status-options three'
  }

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className="manage-form" key={currentStatus}>
      <input type="hidden" name="id" value={parentId} />
      <div className={columnsClass} role="radiogroup" aria-label="Status">
        {statuses.map(function (value) {
          return (
            <label className={'status-option status-' + value} key={value}>
              <input type="radio" name="status" value={value} defaultChecked={value === currentStatus} required />
              <span>
                <strong>{formatStatus(value)}</strong>
                <small>{hints[value]}</small>
              </span>
            </label>
          )
        })}
      </div>
      <label>
        <span>Message</span>
        <textarea name="message" rows={3} required placeholder="What changed? This is shown on the status page." />
      </label>
      {timezone && (
        <label className="update-time">
          <span>Time ({zoneAbbreviation(timezone)})</span>
          <input name="created_at" type="datetime-local" />
          <small className="field-hint">Leave empty for now. An earlier time adds it to the timeline without a notification.</small>
        </label>
      )}
      <div className="form-actions">
        <button type="submit" className="button-primary" disabled={pending}>
          {buttonText}
        </button>
      </div>
    </form>
  )
}
