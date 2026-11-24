import { inputValueToIso, yearMonth } from './time'

export interface CalendarMonth {
  year: number
  month: number
  label: string
}

export function monthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 15)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export function shiftMonth(year: number, month: number, offset: number): CalendarMonth {
  const date = new Date(Date.UTC(year, month - 1 + offset, 15))
  const shiftedYear = date.getUTCFullYear()
  const shiftedMonth = date.getUTCMonth() + 1
  return { year: shiftedYear, month: shiftedMonth, label: monthLabel(shiftedYear, shiftedMonth) }
}

export function currentMonth(timezone: string): { year: number; month: number } {
  return yearMonth(new Date().toISOString(), timezone)
}

export function monthStartIso(month: CalendarMonth, timezone: string): string {
  let monthText = String(month.month)
  if (month.month < 10) {
    monthText = '0' + monthText
  }
  return inputValueToIso(month.year + '-' + monthText + '-01T00:00', timezone)
}

export function readPage(value: string | undefined): number {
  if (value && /^-?\d{1,3}$/.test(value)) {
    return Number(value)
  }
  return 0
}

export function pageHref(path: string, page: number): string {
  if (page === 0) {
    return path
  }
  return path + '?page=' + page
}

export function shortMonthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 15)).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export function rangeLabel(months: CalendarMonth[]): string {
  const first = shortMonthLabel(months[0].year, months[0].month)
  const last = shortMonthLabel(months[months.length - 1].year, months[months.length - 1].month)
  if (first === last) {
    return first
  }
  return first + ' to ' + last
}

export function isInMonth(iso: string, target: CalendarMonth, timezone: string): boolean {
  const value = yearMonth(iso, timezone)
  if (value.year === target.year && value.month === target.month) {
    return true
  }
  return false
}
