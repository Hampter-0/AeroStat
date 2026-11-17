'use client'

import { ChevronLeft, ChevronRight } from '@/components/icons'
import { PER_PAGE_OPTIONS } from '@/lib/activity'
import { pageNumbers } from '@/lib/pagination'

export default function ClientPager({
  page,
  lastPage,
  perPage,
  itemLabel,
  onPage,
  onPerPage,
}: {
  page: number
  lastPage: number
  perPage: number
  itemLabel: string
  onPage: (page: number) => void
  onPerPage: (perPage: number) => void
}) {
  function changePerPage(event: React.ChangeEvent<HTMLSelectElement>) {
    onPerPage(Number(event.target.value))
  }

  let previous = (
    <span className="page-button disabled" aria-hidden="true">
      <ChevronLeft />
    </span>
  )
  if (page > 1) {
    previous = (
      <button
        type="button"
        className="page-button"
        aria-label="Previous page"
        onClick={function () {
          onPage(page - 1)
        }}
      >
        <ChevronLeft />
      </button>
    )
  }
  let next = (
    <span className="page-button disabled" aria-hidden="true">
      <ChevronRight />
    </span>
  )
  if (page < lastPage) {
    next = (
      <button
        type="button"
        className="page-button"
        aria-label="Next page"
        onClick={function () {
          onPage(page + 1)
        }}
      >
        <ChevronRight />
      </button>
    )
  }

  return (
    <div className="activity-bar-controls">
      <label className="per-page">
        <span className="sr-only">{itemLabel} per page</span>
        <select value={perPage} onChange={changePerPage}>
          {PER_PAGE_OPTIONS.map(function (option) {
            return (
              <option value={option} key={option}>
                {option} / page
              </option>
            )
          })}
        </select>
      </label>
      <nav className="pagination" aria-label="Pages">
        {previous}
        {pageNumbers(page, lastPage).map(function (number, index) {
          if (number === null) {
            return (
              <span className="page-gap" key={'gap-' + index}>
                …
              </span>
            )
          }
          if (number === page) {
            return (
              <span className="page-button current" aria-current="page" key={number}>
                {number}
              </span>
            )
          }
          return (
            <button
              type="button"
              className="page-button"
              key={number}
              onClick={function () {
                onPage(number)
              }}
            >
              {number}
            </button>
          )
        })}
        {next}
      </nav>
    </div>
  )
}
