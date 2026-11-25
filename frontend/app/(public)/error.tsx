'use client'

import { useEffect } from 'react'

export default function PublicError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(
    function () {
      console.error(error)
    },
    [error]
  )

  return (
    <section className="status-unavailable">
      <h2>Status temporarily unavailable</h2>
      <p>We can&apos;t load this page right now. Please check back in a moment.</p>
      <button type="button" className="button-primary" onClick={retry}>
        Try again
      </button>
    </section>
  )
}
