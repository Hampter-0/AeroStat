'use client'

import { startTransition, useEffect, useRef, type FormEvent } from 'react'
import type { FormState } from '@/app/manage/actions'
import { useConfirm, type ConfirmOptions } from '@/components/manage/confirm/Confirm'

export function useFormSubmit(formAction: (payload: FormData) => void, state: FormState, confirmOptions?: ConfirmOptions) {
  const formRef = useRef<HTMLFormElement>(null)
  const confirm = useConfirm()

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
    const submitter = (event.nativeEvent as SubmitEvent).submitter
    const formData = new FormData(event.currentTarget, submitter)
    if (!confirmOptions) {
      startTransition(function () {
        formAction(formData)
      })
      return
    }
    confirm(confirmOptions).then(function (ok) {
      if (ok) {
        startTransition(function () {
          formAction(formData)
        })
      }
    })
  }

  return { formRef: formRef, onSubmit: onSubmit }
}

export function useKeepValuesSubmit(formAction: (payload: FormData) => void) {
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const submitter = (event.nativeEvent as SubmitEvent).submitter
    const formData = new FormData(event.currentTarget, submitter)
    startTransition(function () {
      formAction(formData)
    })
  }

  return onSubmit
}
