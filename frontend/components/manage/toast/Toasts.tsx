'use client'

import { usePathname } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { FormState } from '@/app/manage/actions'
import { X } from '@/components/icons'

const SHOW_MS = 4500
const LEAVE_MS = 220
const FLASH_COOKIE = 'aerostat_toast'

interface Toast {
  id: number
  message: string
  leaving: boolean
}

type ShowToast = (message: string) => void

const ToastContext = createContext<ShowToast>(function () {})

let nextId = 1

export function useToast(): ShowToast {
  return useContext(ToastContext)
}

export function useSuccessToast(state: FormState) {
  const show = useToast()
  useEffect(
    function () {
      if (state.success) {
        show(state.success)
      }
    },
    [state, show],
  )
}

function readFlash(): string | null {
  for (const part of document.cookie.split(';')) {
    const trimmed = part.trim()
    if (trimmed.startsWith(FLASH_COOKIE + '=')) {
      const raw = trimmed.slice(FLASH_COOKIE.length + 1)
      document.cookie = FLASH_COOKIE + '=; path=/; max-age=0'
      try {
        return decodeURIComponent(raw)
      } catch {
        return raw
      }
    }
  }
  return null
}

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const pathname = usePathname()

  const remove = useCallback(function (id: number) {
    setToasts(function (list) {
      return list.filter(function (toast) {
        return toast.id !== id
      })
    })
  }, [])

  const dismiss = useCallback(
    function (id: number) {
      setToasts(function (list) {
        return list.map(function (toast) {
          if (toast.id === id) {
            return { id: toast.id, message: toast.message, leaving: true }
          }
          return toast
        })
      })
      window.setTimeout(function () {
        remove(id)
      }, LEAVE_MS)
    },
    [remove],
  )

  const show = useCallback(
    function (message: string) {
      const id = nextId
      nextId = nextId + 1
      setToasts(function (list) {
        return list.concat([{ id: id, message: message, leaving: false }]).slice(-4)
      })
      window.setTimeout(function () {
        dismiss(id)
      }, SHOW_MS)
    },
    [dismiss],
  )

  useEffect(
    function () {
      const message = readFlash()
      if (!message) {
        return
      }
      window.setTimeout(function () {
        show(message)
      }, 0)
    },
    [pathname, show],
  )

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map(function (toast) {
          function close() {
            dismiss(toast.id)
          }
          let className = 'toast'
          if (toast.leaving) {
            className = 'toast leaving'
          }
          return (
            <div className={className} key={toast.id}>
              <span className="toast-bar" aria-hidden="true" />
              <span className="toast-message">{toast.message}</span>
              <button type="button" className="toast-close" onClick={close} aria-label="Close">
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
