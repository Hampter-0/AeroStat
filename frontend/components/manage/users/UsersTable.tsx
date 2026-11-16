'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Crown, Lock, LockOpen, Search } from '@/components/icons'
import Avatar from '@/components/manage/Avatar'
import type { RoleSummary } from '@/lib/permissions'
import { formatDateTimeShort } from '@/lib/time'
import type { UserRecord } from '@/lib/users'

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
  }

  let countText = shown.length + ' of ' + users.length + ' users'
  if (needle === '') {
    countText = users.length + ' users'
    if (users.length === 1) {
      countText = '1 user'
    }
  }

  return (
    <>
      <div className="table-toolbar">
        <label className="activity-search">
          <Search />
          <input value={query} onChange={changeQuery} placeholder="Search…" aria-label="Search users" />
        </label>
        <span className="table-count">{countText}</span>
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
            {shown.map(function (user) {
              let lastLogin = 'Never'
              if (user.last_login_at) {
                lastLogin = formatDateTimeShort(user.last_login_at, timezone)
              }
              const userRoles = rolesOf(user)
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
                          {user.owner && (
                            <span className="user-badge super" title="Owner">
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
                          {user.id === currentUserId && <span className="you-tag">You</span>}
                        </span>
                        {user.email && <small>{user.email}</small>}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="user-row-access">
                      {user.super_user && <span className="chip admin">Super user</span>}
                      {userRoles.length === 0 && user.permissions.length === 0 && !user.super_user && (
                        <span className="chip muted">No role</span>
                      )}
                      {userRoles.map(function (role) {
                        let className = 'chip'
                        if (role.super_user) {
                          className = 'chip admin'
                        }
                        return (
                          <span className={className} key={role.id}>
                            {role.name}
                          </span>
                        )
                      })}
                      {user.permissions.length > 0 && <span className="chip">+{user.permissions.length} extra</span>}
                    </div>
                  </td>
                  <td className="table-muted">{lastLogin}</td>
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
    </>
  )
}
