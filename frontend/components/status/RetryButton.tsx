'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

export default function RetryButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [tried, setTried] = useState(false)

  function retry() {
    setTried(true)
    startTransition(function () {
      router.refresh()
    })
  }

  let label = 'Try again'
  if (pending) {
    label = 'Trying…'
  } else if (tried) {
    label = 'Still unavailable, try again'
  }

  return (
    <button type="button" className="button-primary" onClick={retry} disabled={pending}>
      {label}
    </button>
  )
}
