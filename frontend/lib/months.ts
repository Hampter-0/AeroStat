import { yearMonth } from './time'

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

export function isInMonth(iso: string, target: CalendarMonth, timezone: string): boolean {
  const value = yearMonth(iso, timezone)
  if (value.year === target.year && value.month === target.month) {
    return true
  }
  return false
}
