'use client'

import { useActionState, useEffect, useState } from 'react'
import type { FormState } from '@/app/manage/actions'
import { checkAllNow } from '@/app/manage/(panel)/services/actions'
import { useResultToast } from '@/components/manage/toast/Toasts'

const initialState: FormState = { error: null, success: null }

const FEEDBACK_MS = 3000

export default function CheckNowButton() {
  const [state, formAction, pending] = useActionState(checkAllNow, initialState)
  useResultToast(state)
  const [expiredState, setExpiredState] = useState<FormState | null>(null)

  useEffect(
    function () {
      if (state === initialState) {
        return
      }
      const timer = window.setTimeout(function () {
        setExpiredState(state)
      }, FEEDBACK_MS)
      return function () {
        window.clearTimeout(timer)
      }
    },
    [state]
  )

  let showFeedback = false
  if (state !== initialState && expiredState !== state) {
    showFeedback = true
  }

  let label = 'Check all now'
  let className = 'button-secondary check-now-button'
  if (pending) {
    label = 'Checking…'
  } else if (showFeedback && state.error) {
    label = 'Not started'
    className = 'button-secondary check-now-button failed'
  }

  let title = 'Check every service right away instead of waiting for its interval'
  if (state.error) {
    title = state.error
  }

  return (
    <form action={formAction}>
      <button type="submit" className={className} disabled={pending} title={title} aria-live="polite">
        {label}
      </button>
    </form>
  )
}
