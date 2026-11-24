'use client'

import { useCallback, useEffect, useRef } from 'react'
import { markNoticesRead, noticeCount, unreadNotices } from '@/app/manage/(panel)/panel-notice-actions'
import { useNotice } from '@/components/manage/toast/Toasts'
import type { GlyphKind } from '@/components/StatusGlyph'
import type { PanelNotice } from '@/lib/panel-notices'

const POLL_MS = 30000

function glyphFor(item: PanelNotice): GlyphKind {
  if (item.tone === 'green') {
    return 'check'
  }
  if (item.kind === 'service_down' || item.kind === 'maintenance_cancelled') {
    return 'x'
  }
  if (item.kind === 'service_slow') {
    return 'gauge'
  }
  if (item.kind === 'maintenance_scheduled') {
    return 'clock'
  }
  if (item.kind === 'maintenance_started') {
    return 'wrench'
  }
  return 'alert'
}
const MAX_AT_ONCE = 3

export default function PanelNotices() {
  const notify = useNotice()
  const shown = useRef<number[]>([])

  const check = useCallback(
    function () {
      noticeCount().then(function (summary) {
        if (!summary || summary.unread === 0) {
          return
        }
        unreadNotices().then(function (items) {
          if (!items) {
            return
          }
          const fresh = items.filter(function (item) {
            return !shown.current.includes(item.id)
          })
          if (fresh.length === 0) {
            return
          }
          const newest = fresh.slice(0, MAX_AT_ONCE)
          for (const item of newest.slice().reverse()) {
            notify({ title: item.title, body: item.body, tone: item.tone.replace('grey', 'gray'), kind: glyphFor(item), href: item.path })
          }
          if (fresh.length > MAX_AT_ONCE) {
            let more = (fresh.length - MAX_AT_ONCE) + ' more notifications'
            if (fresh.length - MAX_AT_ONCE === 1) {
              more = '1 more notification'
            }
            notify({ title: more, body: 'They were sent to you while you were away.', tone: 'gray', kind: 'pending', href: null })
          }
          const ids = fresh.map(function (item) {
            return item.id
          })
          shown.current = shown.current.concat(ids)
          markNoticesRead(ids)
        })
      })
    },
    [notify]
  )

  useEffect(
    function () {
      check()
      const timer = window.setInterval(function () {
        if (document.visibilityState === 'visible') {
          check()
        }
      }, POLL_MS)
      function onVisible() {
        if (document.visibilityState === 'visible') {
          check()
        }
      }
      document.addEventListener('visibilitychange', onVisible)
      return function () {
        window.clearInterval(timer)
        document.removeEventListener('visibilitychange', onVisible)
      }
    },
    [check]
  )

  return null
}
