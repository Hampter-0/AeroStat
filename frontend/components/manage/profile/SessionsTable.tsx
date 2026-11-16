'use client'

import { useActionState, useState } from 'react'
import type { FormState } from '@/app/manage/actions'
import { endOtherSessions, endSession } from '@/app/manage/(panel)/profile/actions'
import { LogOut, Search } from '@/components/icons'
import { useConfirmedSubmit } from '@/components/manage/confirm/Confirm'
import { useSuccessToast } from '@/components/manage/toast/Toasts'
import type { SessionRow } from '@/lib/sessions'

const initialState: FormState = { error: null, success: null }

function EndButton({ id }: { id: number }) {
  const [state, formAction, pending] = useActionState(endSession, initialState)
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="button-secondary" disabled={pending}>
        Log out
      </button>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
    </form>
  )
}

export default function SessionsTable({ sessions }: { sessions: SessionRow[] }) {
  const [query, setQuery] = useState('')
  const [othersState, othersAction, endingOthers] = useActionState(endOtherSessions, initialState)
  useSuccessToast(othersState)

  function changeQuery(event: React.ChangeEvent<HTMLInputElement>) {
    setQuery(event.target.value)
  }

  const confirmOthers = useConfirmedSubmit(othersAction, {
    title: 'Log out every other device?',
    message: 'You stay signed in here.',
    confirmText: 'Log out others',
    danger: true,
  })

  const needle = query.trim().toLowerCase()
  const shown: SessionRow[] = []
  for (const session of sessions) {
    const haystack = (session.ip + ' ' + session.device + ' ' + session.userAgent).toLowerCase()
    if (needle === '' || haystack.includes(needle)) {
      shown.push(session)
    }
  }

  let others = 0
  for (const session of sessions) {
    if (!session.current) {
      others = others + 1
    }
  }

  return (
    <>
      <div className="table-toolbar">
        <label className="activity-search">
          <Search />
          <input value={query} onChange={changeQuery} placeholder="Search…" aria-label="Search sessions" />
        </label>
        {others > 0 && (
          <form action={othersAction} onSubmit={confirmOthers}>
            <button type="submit" className="button-danger" disabled={endingOthers}>
              <LogOut /> Log out others
            </button>
          </form>
        )}
      </div>
      {othersState.error && <p className="form-error" role="alert">{othersState.error}</p>}
      <div className="activity-table-wrap">
        <table className="activity-table sessions-table">
          <thead>
            <tr>
              <th>IP</th>
              <th>This device?</th>
              <th>Device</th>
              <th>Last used</th>
              <th>
                <span className="sr-only">Log out</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={5} className="manage-empty">
                  No sessions match your search.
                </td>
              </tr>
            )}
            {shown.map(function (session) {
              let thisDevice = 'No'
              if (session.current) {
                thisDevice = 'Yes'
              }
              return (
                <tr key={session.id}>
                  <td>
                    <code>{session.ip}</code>
                  </td>
                  <td>{thisDevice}</td>
                  <td>
                    <span className="session-device" title={session.userAgent}>
                      <strong>{session.device}</strong>
                      <small>{session.userAgent}</small>
                    </span>
                  </td>
                  <td className="table-muted">{session.lastUsed}</td>
                  <td className="table-action">{!session.current && <EndButton id={session.id} />}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
