'use client'

import { useActionState, useState } from 'react'
import DateTimeField from '@/components/manage/DateTimeField'
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

  const [status, setStatus] = useState(currentStatus)

  function changeStatus(event: React.ChangeEvent<HTMLSelectElement>) {
    setStatus(event.target.value)
  }

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className="manage-form" key={currentStatus}>
      <input type="hidden" name="id" value={parentId} />
      <label>
        <span>Status</span>
        <select name="status" value={status} onChange={changeStatus} required>
          {statuses.map(function (value) {
            return (
              <option value={value} key={value}>
                {formatStatus(value)}
              </option>
            )
          })}
        </select>
        {hints[status] && <small className="field-hint">{hints[status]}</small>}
      </label>
      <label>
        <span>Message</span>
        <textarea name="message" rows={3} required placeholder="What changed? This is shown on the status page." />
      </label>
      {timezone && (
        <label className="update-time">
          <span>Time ({zoneAbbreviation(timezone)})</span>
          <DateTimeField name="created_at" placeholder="Now" timezone={timezone} />
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
