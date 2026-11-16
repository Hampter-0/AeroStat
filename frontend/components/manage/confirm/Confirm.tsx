'use client'

import { createContext, startTransition, useCallback, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmText: string
  danger?: boolean
}

type AskConfirm = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<AskConfirm>(function () {
  return Promise.resolve(false)
})

interface Pending {
  options: ConfirmOptions
  resolve: (answer: boolean) => void
}

export function useConfirm(): AskConfirm {
  return useContext(ConfirmContext)
}

export function useConfirmedSubmit(formAction: (payload: FormData) => void, options: ConfirmOptions | (() => ConfirmOptions)) {
  const confirm = useConfirm()

  return function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const submitter = (event.nativeEvent as SubmitEvent).submitter
    const formData = new FormData(event.currentTarget, submitter)
    let resolved: ConfirmOptions
    if (typeof options === 'function') {
      resolved = options()
    } else {
      resolved = options
    }
    confirm(resolved).then(function (ok) {
      if (ok) {
        startTransition(function () {
          formAction(formData)
        })
      }
    })
  }
}

export default function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  const ask = useCallback(function (options: ConfirmOptions) {
    return new Promise<boolean>(function (resolve) {
      setPending({ options: options, resolve: resolve })
    })
  }, [])

  useEffect(
    function () {
      const dialog = dialogRef.current
      if (dialog && pending && !dialog.open) {
        dialog.showModal()
      }
    },
    [pending],
  )

  function answer(value: boolean) {
    if (pending) {
      pending.resolve(value)
    }
    if (dialogRef.current && dialogRef.current.open) {
      dialogRef.current.close()
    }
    setPending(null)
  }

  function cancel() {
    answer(false)
  }

  function accept() {
    answer(true)
  }

  function onCancel(event: React.SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault()
    answer(false)
  }

  function onBackdrop(event: React.MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) {
      answer(false)
    }
  }

  let confirmClass = 'button-primary'
  if (pending && pending.options.danger) {
    confirmClass = 'button-danger'
  }

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      <dialog ref={dialogRef} className="confirm-dialog" onCancel={onCancel} onClick={onBackdrop}>
        {pending && (
          <div className="confirm-body">
            <h2>{pending.options.title}</h2>
            {pending.options.message && <p>{pending.options.message}</p>}
            <div className="form-actions">
              <button type="button" className="button-secondary" onClick={cancel}>
                Cancel
              </button>
              <button type="button" className={confirmClass} onClick={accept} autoFocus>
                {pending.options.confirmText}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </ConfirmContext.Provider>
  )
}
