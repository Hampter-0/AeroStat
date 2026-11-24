'use client'

import { useCallback, useEffect, useRef } from 'react'
import { markNoticesRead, noticeCount, unreadNotices } from '@/app/manage/(panel)/panel-notice-actions'
import { useNotice } from '@/components/manage/toast/Toasts'

const POLL_MS = 30000
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
            notify({ title: item.title, body: item.body, tone: item.tone, href: item.path })
          }
          if (fresh.length > MAX_AT_ONCE) {
            let more = (fresh.length - MAX_AT_ONCE) + ' more notifications'
            if (fresh.length - MAX_AT_ONCE === 1) {
              more = '1 more notification'
            }
            notify({ title: more, body: 'They were sent to you while you were away.', tone: 'grey', href: null })
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
