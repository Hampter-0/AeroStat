'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Crown, Lock, LockOpen, Search } from '@/components/icons'
import Avatar from '@/components/manage/Avatar'
import ClientPager from '@/components/manage/ClientPager'
import { DEFAULT_PER_PAGE } from '@/lib/activity'
import type { RoleSummary } from '@/lib/permissions'
import { formatDateTimeShort } from '@/lib/time'
import type { UserRecord } from '@/lib/users'

const SHOWN_ROLES = 2

export default function UsersTable({
  users,
  roles,
  currentUserId,
  timezone,
  canEdit,
}: {
  users: UserRecord[]
  roles: RoleSummary[]
  currentUserId: number
  timezone: string
  canEdit: boolean
}) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE)
  const [expanded, setExpanded] = useState<number[]>([])

  function toggleRoles(userId: number) {
    if (expanded.includes(userId)) {
      const next: number[] = []
      for (const id of expanded) {
        if (id !== userId) {
          next.push(id)
        }
      }
      setExpanded(next)
    } else {
      setExpanded(expanded.concat([userId]))
    }
  }

  const roleById = new Map<number, RoleSummary>()
  for (const role of roles) {
    roleById.set(role.id, role)
  }

  function rolesOf(user: UserRecord): RoleSummary[] {
    const list: RoleSummary[] = []
    for (const id of user.role_ids) {
      const role = roleById.get(id)
      if (role) {
        list.push(role)
      }
    }
    return list
  }

  let openText = 'View'
  if (canEdit) {
    openText = 'Edit'
  }

  const needle = query.trim().toLowerCase()
  const shown: UserRecord[] = []
  for (const user of users) {
    let haystack = user.username
    if (user.email) {
      haystack = haystack + ' ' + user.email
    }
    for (const role of rolesOf(user)) {
      haystack = haystack + ' ' + role.name
    }
    if (needle === '' || haystack.toLowerCase().includes(needle)) {
      shown.push(user)
    }
  }

  function changeQuery(event: React.ChangeEvent<HTMLInputElement>) {
    setQuery(event.target.value)
    setPage(1)
  }

  const lastPage = Math.max(1, Math.ceil(shown.length / perPage))
  let currentPage = page
  if (currentPage > lastPage) {
    currentPage = lastPage
  }
  const first = (currentPage - 1) * perPage
  const pageUsers = shown.slice(first, first + perPage)

  let countText = shown.length + ' of ' + users.length + ' users'
  if (needle === '') {
    countText = users.length + ' users'
    if (users.length === 1) {
      countText = '1 user'
    }
  }
  if (shown.length > 0) {
    countText = 'Showing ' + (first + 1) + ' to ' + (first + pageUsers.length) + ' of ' + shown.length + ' users'
  }

  function changePerPage(value: number) {
    setPerPage(value)
    setPage(1)
  }

  const pager = (
    <ClientPager page={currentPage} lastPage={lastPage} perPage={perPage} itemLabel="Users" onPage={setPage} onPerPage={changePerPage} />
  )

  return (
    <>
      <div className="table-toolbar">
        <label className="activity-search">
          <Search />
          <input value={query} onChange={changeQuery} placeholder="Search…" aria-label="Search users" />
        </label>
        <span className="table-count">{countText}</span>
        {pager}
      </div>
      <div className="activity-table-wrap">
        <table className="activity-table users-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Roles</th>
              <th>Last sign-in</th>
              <th>
                <span className="sr-only">Edit</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={4} className="manage-empty">
                  No users match your search.
                </td>
              </tr>
            )}
            {pageUsers.map(function (user) {
              let lastLogin = 'Never'
              if (user.last_login_at) {
                lastLogin = formatDateTimeShort(user.last_login_at, timezone)
              }
              const chips: { key: string; name: string; admin: boolean }[] = []
              if (user.is_admin) {
                chips.push({ key: 'admin', name: 'Admin', admin: true })
              }
              for (const role of rolesOf(user)) {
                chips.push({ key: 'role-' + role.id, name: role.name, admin: false })
              }
              const open = expanded.includes(user.id)
              let shownChips = chips.slice(0, SHOWN_ROLES)
              if (open) {
                shownChips = chips
              }
              const hiddenChips = chips.slice(SHOWN_ROLES)
              const hiddenNames: string[] = []
              for (const chip of hiddenChips) {
                hiddenNames.push(chip.name)
              }
              const hiddenText = hiddenNames.join(', ')
              const passkeyOnly = user.passkeys > 0 && !user.password_login
              const secured = user.two_factor || passkeyOnly
              let secureText = 'No two-factor sign-in'
              if (user.two_factor) {
                secureText = 'Two-factor sign-in is on'
              } else if (passkeyOnly) {
                secureText = 'Signs in with a passkey only'
              }
              return (
                <tr key={user.id}>
                  <td>
                    <div className="table-user">
                      <Avatar userId={user.id} username={user.username} version={user.avatar_version} size={30} />
                      <span className="user-row-names">
                        <span className="user-row-title">
                          <strong>{user.username}</strong>
                          {user.is_admin && (
                            <span className="user-badge super" title="Admin">
                              <Crown />
                            </span>
                          )}
                          {secured && (
                            <span className="user-badge secured" title={secureText}>
                              <Lock size={13} />
                            </span>
                          )}
                          {!secured && (
                            <span className="user-badge unsecured" title={secureText}>
                              <LockOpen size={13} />
                            </span>
                          )}
                          {user.owner && <span className="you-tag">Owner</span>}
                          {user.suspended && <span className="you-tag suspended">Suspended</span>}
                          {user.id === currentUserId && <span className="you-tag">You</span>}
                        </span>
                        {user.email && <small>{user.email}</small>}
                      </span>
                    </div>
                  </td>
                  <td className="users-roles-cell">
                    <div className="user-row-access">
                      {chips.length === 0 && user.permissions.length === 0 && <span className="chip muted">No role</span>}
                      {shownChips.map(function (chip) {
                        let className = 'chip'
                        if (chip.admin) {
                          className = 'chip admin'
                        }
                        return (
                          <span className={className} key={chip.key}>
                            {chip.name}
                          </span>
                        )
                      })}
                      {hiddenChips.length > 0 && !open && (
                        <button
                          type="button"
                          className="chip more"
                          title={hiddenText}
                          aria-label={'Show ' + hiddenChips.length + ' more roles: ' + hiddenText}
                          onClick={function () {
                            toggleRoles(user.id)
                          }}
                        >
                          +{hiddenChips.length}
                        </button>
                      )}
                      {hiddenChips.length > 0 && open && (
                        <button
                          type="button"
                          className="chip more"
                          onClick={function () {
                            toggleRoles(user.id)
                          }}
                        >
                          Less
                        </button>
                      )}
                      {user.permissions.length > 0 && <span className="chip">+{user.permissions.length} extra</span>}
                    </div>
                  </td>
                  <td className="table-muted users-login-cell">
                    {lastLogin}
                  </td>
                  <td className="table-action">
                    <Link href={'/manage/users/' + user.id} className="button-secondary">
                      {openText}
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {shown.length > 0 && (
        <div className="activity-bar">
          <p>{countText}</p>
          {pager}
        </div>
      )}
    </>
  )
}
