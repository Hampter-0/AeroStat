'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Chevron, Monitor, Moon, Sun } from '@/components/icons'
import {
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
  applyTheme,
  readChoice,
  readServerChoice,
  subscribeToChoice,
  type ThemeChoice,
} from '@/lib/theme-client'

const options: { value: ThemeChoice; label: string; icon: React.ReactNode }[] = [
  { value: 'system', label: 'System', icon: <Monitor /> },
  { value: 'light', label: 'Light', icon: <Sun /> },
  { value: 'dark', label: 'Dark', icon: <Moon /> },
]

export default function ThemeSwitcher() {
  const choice = useSyncExternalStore(subscribeToChoice, readChoice, readServerChoice)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(
    function () {
      if (!open) {
        return
      }
      function onPointerDown(event: PointerEvent) {
        if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
          setOpen(false)
        }
      }
      function onKeyDown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
          setOpen(false)
        }
      }
      document.addEventListener('pointerdown', onPointerDown)
      document.addEventListener('keydown', onKeyDown)
      return function () {
        document.removeEventListener('pointerdown', onPointerDown)
        document.removeEventListener('keydown', onKeyDown)
      }
    },
    [open]
  )

  function choose(next: ThemeChoice) {
    setOpen(false)
    try {
      if (next === 'system') {
        localStorage.removeItem(THEME_STORAGE_KEY)
      } else {
        localStorage.setItem(THEME_STORAGE_KEY, next)
      }
    } catch {
      applyTheme(next)
      return
    }
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
  }

  function toggleOpen() {
    setOpen(!open)
  }

  let current = options[0]
  for (const option of options) {
    if (option.value === choice) {
      current = option
    }
  }

  return (
    <div className="dropdown theme-switcher" ref={rootRef}>
      <button
        type="button"
        className="dropdown-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={'Theme: ' + current.label}
        onClick={toggleOpen}
      >
        {current.icon}
        <Chevron open={open} />
      </button>
      {open && (
        <div className="dropdown-menu" role="menu">
          {options.map(function (option) {
            let className = ''
            if (option.value === choice) {
              className = 'active'
            }
            return (
              <button
                type="button"
                role="menuitemradio"
                aria-checked={option.value === choice}
                key={option.value}
                className={className}
                onClick={function () {
                  choose(option.value)
                }}
              >
                {option.icon}
                {option.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
