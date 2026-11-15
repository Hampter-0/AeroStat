'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { currentTimeMs, formatAgo } from '@/lib/time'

const TICK_MS = 1000
const REFRESH_MS = 60000

export default function LastChecked({ checkedAt, renderedAt }: { checkedAt: string; renderedAt: number }) {
  const router = useRouter()
  const [now, setNow] = useState(renderedAt)

  useEffect(
    function () {
      const tick = window.setInterval(function () {
        setNow(currentTimeMs())
      }, TICK_MS)
      const refresh = window.setInterval(function () {
        router.refresh()
      }, REFRESH_MS)
      return function () {
        window.clearInterval(tick)
        window.clearInterval(refresh)
      }
    },
    [router],
  )

  return (
    <p className="last-checked">
      Last checked{' '}
      <time dateTime={checkedAt} title={new Date(checkedAt).toUTCString()}>
        {formatAgo(now - new Date(checkedAt).getTime())}
      </time>
    </p>
  )
}
