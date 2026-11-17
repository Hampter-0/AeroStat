export function pageNumbers(current: number, last: number): (number | null)[] {
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
