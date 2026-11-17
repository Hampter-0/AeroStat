'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Search } from '@/components/icons'
import ClientPager from '@/components/manage/ClientPager'
import { DEFAULT_PER_PAGE } from '@/lib/activity'
import type { Role } from '@/lib/permissions'

export default function RolesTable({ roles, openText }: { roles: Role[]; openText: string }) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE)

  const needle = query.trim().toLowerCase()
  const shown: Role[] = []
  for (const role of roles) {
    const haystack = role.name + ' ' + role.handle
    if (needle === '' || haystack.toLowerCase().includes(needle)) {
      shown.push(role)
    }
  }

  function changeQuery(event: React.ChangeEvent<HTMLInputElement>) {
    setQuery(event.target.value)
    setPage(1)
  }

  function changePerPage(value: number) {
    setPerPage(value)
    setPage(1)
  }

  const lastPage = Math.max(1, Math.ceil(shown.length / perPage))
  let currentPage = page
  if (currentPage > lastPage) {
    currentPage = lastPage
  }
  const first = (currentPage - 1) * perPage
  const pageRoles = shown.slice(first, first + perPage)

  let countText = shown.length + ' of ' + roles.length + ' roles'
  if (needle === '') {
    countText = roles.length + ' roles'
    if (roles.length === 1) {
      countText = '1 role'
    }
  }
  if (shown.length > 0) {
    countText = 'Showing ' + (first + 1) + ' to ' + (first + pageRoles.length) + ' of ' + shown.length + ' roles'
  }

  const pager = (
    <ClientPager page={currentPage} lastPage={lastPage} perPage={perPage} itemLabel="Roles" onPage={setPage} onPerPage={changePerPage} />
  )

  return (
    <>
      <div className="table-toolbar">
        <label className="activity-search">
          <Search />
          <input value={query} onChange={changeQuery} placeholder="Search…" aria-label="Search roles" />
        </label>
        <span className="table-count">{countText}</span>
        {pager}
      </div>
      <div className="activity-table-wrap">
        <table className="activity-table roles-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Handle</th>
              <th>Access</th>
              <th>Users</th>
              <th>
                <span className="sr-only">Edit</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {pageRoles.length === 0 && (
              <tr>
                <td colSpan={5} className="manage-empty">
                  No roles match your search.
                </td>
              </tr>
            )}
            {pageRoles.map(function (role) {
              let access = <span className="table-muted">{role.permissions.length} permissions</span>
              if (role.permissions.length === 1) {
                access = <span className="table-muted">1 permission</span>
              }
              if (role.super_user) {
                access = <span className="chip admin">Super user</span>
              }
              return (
                <tr key={role.id}>
                  <td>
                    <strong>{role.name}</strong>
                  </td>
                  <td>
                    <code>{role.handle}</code>
                  </td>
                  <td>{access}</td>
                  <td className="table-muted">{role.users}</td>
                  <td className="table-action">
                    <Link href={'/manage/roles/' + role.id} className="button-secondary">
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
