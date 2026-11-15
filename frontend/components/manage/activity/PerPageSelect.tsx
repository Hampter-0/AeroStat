'use client'

import { useRouter } from 'next/navigation'
import { PER_PAGE_OPTIONS, activityHref, type ActivityQuery } from '@/lib/activity'

export default function PerPageSelect({ query }: { query: ActivityQuery }) {
  const router = useRouter()

  function change(event: React.ChangeEvent<HTMLSelectElement>) {
    router.push(activityHref({ ...query, perPage: Number(event.target.value), page: 1 }))
  }

  return (
    <label className="per-page">
      <span className="sr-only">Results per page</span>
      <select value={query.perPage} onChange={change}>
        {PER_PAGE_OPTIONS.map(function (option) {
          return (
            <option value={option} key={option}>
              {option} / page
            </option>
          )
        })}
      </select>
    </label>
  )
}
