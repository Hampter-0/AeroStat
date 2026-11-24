'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { FormState } from '@/app/manage/actions'
import { X } from '@/components/icons'
import StatusGlyph, { type GlyphKind } from '@/components/StatusGlyph'

const SHOW_MS = 4500
const ERROR_SHOW_MS = 8000
const NOTICE_SHOW_MS = 9000
const LEAVE_MS = 220
const FLASH_COOKIE = 'aerostat_toast'

export type ToastTone = 'success' | 'error' | 'notice'

export interface Notice {
  title: string
  body: string
  tone: string
  kind: GlyphKind
  href: string | null
}

interface Toast {
  id: number
  message: string
  tone: ToastTone
  notice: Notice | null
  leaving: boolean
}

type ShowToast = (message: string, tone?: ToastTone) => void
type ShowNotice = (notice: Notice) => void

const ToastContext = createContext<ShowToast>(function () {})
const NoticeContext = createContext<ShowNotice>(function () {})

let nextId = 1

export function useToast(): ShowToast {
  return useContext(ToastContext)
}

export function useNotice(): ShowNotice {
  return useContext(NoticeContext)
}

export function useResultToast(state: FormState) {
  const show = useToast()
  useEffect(
    function () {
      if (state.success) {
        show(state.success, 'success')
      }
      if (state.error) {
        show(state.error, 'error')
      }
    },
    [state, show],
  )
}

export function useErrorToast(error: string | null) {
  const show = useToast()
  useEffect(
    function () {
      if (error) {
        show(error, 'error')
      }
    },
    [error, show],
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
            return { id: toast.id, message: toast.message, tone: toast.tone, notice: toast.notice, leaving: true }
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

  const add = useCallback(
    function (message: string, kind: ToastTone, notice: Notice | null, wait: number) {
      const id = nextId
      nextId = nextId + 1
      setToasts(function (list) {
        return list.concat([{ id: id, message: message, tone: kind, notice: notice, leaving: false }]).slice(-4)
      })
      window.setTimeout(function () {
        dismiss(id)
      }, wait)
    },
    [dismiss],
  )

  const show = useCallback(
    function (message: string, tone?: ToastTone) {
      if (tone === 'error') {
        add(message, 'error', null, ERROR_SHOW_MS)
        return
      }
      add(message, 'success', null, SHOW_MS)
    },
    [add],
  )

  const notify = useCallback(
    function (notice: Notice) {
      add(notice.title, 'notice', notice, NOTICE_SHOW_MS)
    },
    [add],
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
      <NoticeContext.Provider value={notify}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map(function (toast) {
          function close() {
            dismiss(toast.id)
          }
          let className = 'toast ' + toast.tone
          if (toast.leaving) {
            className = className + ' leaving'
          }
          let role = 'status'
          if (toast.tone === 'error') {
            role = 'alert'
          }
          if (toast.notice) {
            const notice = toast.notice
            let content = (
              <span className="toast-notice">
                <strong>{notice.title}</strong>
                {notice.body && <span>{notice.body}</span>}
              </span>
            )
            if (notice.href) {
              content = (
                <Link href={notice.href} className="toast-notice" onClick={close}>
                  <strong>{notice.title}</strong>
                  {notice.body && <span>{notice.body}</span>}
                </Link>
              )
            }
            return (
              <div className={className + ' tone-' + notice.tone} key={toast.id} role={role}>
                <span className="toast-icon">
                  <StatusGlyph kind={notice.kind} />
                </span>
                {content}
                <button type="button" className="toast-close" onClick={close} aria-label="Close">
                  <X size={14} />
                </button>
              </div>
            )
          }
          let toneClass = ' tone-green'
          let glyph: GlyphKind = 'check'
          if (toast.tone === 'error') {
            toneClass = ' tone-red'
            glyph = 'x'
          }
          return (
            <div className={className + toneClass} key={toast.id} role={role}>
              <span className="toast-icon">
                <StatusGlyph kind={glyph} />
              </span>
              <span className="toast-message">{toast.message}</span>
              <button type="button" className="toast-close" onClick={close} aria-label="Close">
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
      </NoticeContext.Provider>
    </ToastContext.Provider>
  )
}
