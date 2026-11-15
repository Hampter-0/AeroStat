'use client'

import { useActionState } from 'react'
import type { FormState } from '@/app/manage/actions'
import { ArrowDown, ArrowUp } from '@/components/icons'

const initialState: FormState = { error: null, success: null }

export default function MoveButtons({
  id,
  label,
  isFirst,
  isLast,
  action,
}: {
  id: string
  label: string
  isFirst: boolean
  isLast: boolean
  action: (state: FormState, formData: FormData) => Promise<FormState>
}) {
  const [state, formAction, pending] = useActionState(action, initialState)

  let upDisabled = pending
  if (isFirst) {
    upDisabled = true
  }
  let downDisabled = pending
  if (isLast) {
    downDisabled = true
  }

  return (
    <form action={formAction} className="move-buttons" title={state.error || undefined}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" name="direction" value="up" className="icon-button small" disabled={upDisabled} aria-label={'Move ' + label + ' up'}>
        <ArrowUp />
      </button>
      <button type="submit" name="direction" value="down" className="icon-button small" disabled={downDisabled} aria-label={'Move ' + label + ' down'}>
        <ArrowDown />
      </button>
    </form>
  )
}
