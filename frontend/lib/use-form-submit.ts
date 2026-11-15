'use client'

import { startTransition, useEffect, useRef, type FormEvent } from 'react'
import type { FormState } from '@/app/manage/actions'

export function useFormSubmit(formAction: (payload: FormData) => void, state: FormState, confirm?: () => boolean) {
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(
    function () {
      const form = formRef.current
      if (!form) {
        return
      }
      if (state.error) {
        for (const field of form.querySelectorAll<HTMLInputElement>('input[type="password"]')) {
          field.value = ''
        }
      } else if (state.success) {
        form.reset()
      }
    },
    [state],
  )

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (confirm && !confirm()) {
      return
    }
    const submitter = (event.nativeEvent as SubmitEvent).submitter
    const formData = new FormData(event.currentTarget, submitter)
    startTransition(function () {
      formAction(formData)
    })
  }

  return { formRef: formRef, onSubmit: onSubmit }
}
