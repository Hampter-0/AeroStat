'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { TIMEZONE_COOKIE, timezoneCookieValue, type TimezoneChoice } from '@/lib/timezone-choice'

const ONE_YEAR = 60 * 60 * 24 * 365

function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

function saveChoice(choice: TimezoneChoice | null) {
  if (choice === null) {
    document.cookie = TIMEZONE_COOKIE + '=; path=/; max-age=0; samesite=lax'
    return
  }
  document.cookie =
    TIMEZONE_COOKIE + '=' + encodeURIComponent(timezoneCookieValue(choice)) + '; path=/; max-age=' + ONE_YEAR + '; samesite=lax'
}

export default function TimezonePicker({
  label,
  siteTimezone,
  choice,
  zones,
}: {
  label: string
  siteTimezone: string
  choice: TimezoneChoice
  zones: string[]
}) {
  const router = useRouter()

  useEffect(
    function () {
      if (choice.mode !== 'local') {
        return
      }
      const detected = browserTimezone()
      if (detected && detected !== choice.zone) {
        saveChoice({ mode: 'local', zone: detected })
        router.refresh()
      }
    },
    [choice, router]
  )

  function onChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value
    if (value === 'site') {
      saveChoice(null)
    } else if (value === 'local') {
      saveChoice({ mode: 'local', zone: browserTimezone() })
    } else {
      saveChoice({ mode: 'custom', zone: value.slice('zone:'.length) })
    }
    router.refresh()
  }

  let selected = 'site'
  if (choice.mode === 'local') {
    selected = 'local'
  } else if (choice.mode === 'custom') {
    selected = 'zone:' + choice.zone
  }

  return (
    <div className="timezone-picker">
      <span>Times shown in {label}</span>
      <select value={selected} onChange={onChange} aria-label="Timezone for dates and times">
        <option value="site">Site time ({siteTimezone.replaceAll('_', ' ')})</option>
        <option value="local">My local time</option>
        <optgroup label="Choose a timezone">
          {zones.map(function (zone) {
            return (
              <option value={'zone:' + zone} key={zone}>
                {zone.replaceAll('_', ' ')}
              </option>
            )
          })}
        </optgroup>
      </select>
    </div>
  )
}
