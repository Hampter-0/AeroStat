'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import Logo from '@/components/layout/Logo'

export default function ManageError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(
    function () {
      console.error(error)
    },
    [error]
  )

  return (
    <div className="manage-login">
      <div className="manage-login-inner">
        <div className="manage-login-brand">
          <Logo size={44} />
        </div>
        <div className="manage-login-card manage-error">
          <h1>Can&apos;t reach the server</h1>
          <p>The backend isn&apos;t responding. Check that it&apos;s running, then try again.</p>
          <div className="manage-error-actions">
            <button type="button" className="button-primary" onClick={retry}>
              Try again
            </button>
            <Link href="/" className="button-secondary">
              Status page
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
