import Link from 'next/link'
import { ChevronLeft, ChevronRight } from '@/components/icons'
import { activityHref, type ActivityQuery } from '@/lib/activity'

function pageNumbers(current: number, last: number): (number | null)[] {
  const wanted = new Set<number>([1, last, current - 1, current, current + 1])
  const pages: (number | null)[] = []
  let previous = 0
  for (let page = 1; page <= last; page++) {
    if (wanted.has(page)) {
      if (page - previous > 1) {
        pages.push(null)
      }
      pages.push(page)
      previous = page
    }
  }
  return pages
}

export default function Pagination({ query, lastPage }: { query: ActivityQuery; lastPage: number }) {
  let previous = <span className="page-button disabled" aria-hidden="true"><ChevronLeft /></span>
  if (query.page > 1) {
    previous = (
      <Link href={activityHref({ ...query, page: query.page - 1 })} className="page-button" aria-label="Previous page">
        <ChevronLeft />
      </Link>
    )
  }

  let next = <span className="page-button disabled" aria-hidden="true"><ChevronRight /></span>
  if (query.page < lastPage) {
    next = (
      <Link href={activityHref({ ...query, page: query.page + 1 })} className="page-button" aria-label="Next page">
        <ChevronRight />
      </Link>
    )
  }

  return (
    <nav className="pagination" aria-label="Pages">
      {previous}
      {pageNumbers(query.page, lastPage).map(function (page, index) {
        if (page === null) {
          return (
            <span className="page-gap" key={'gap-' + index}>
              …
            </span>
          )
        }
        if (page === query.page) {
          return (
            <span className="page-button current" aria-current="page" key={page}>
              {page}
            </span>
          )
        }
        return (
          <Link href={activityHref({ ...query, page: page })} className="page-button" key={page}>
            {page}
          </Link>
        )
      })}
      {next}
    </nav>
  )
}
