'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Chevron, Monitor, Moon, Sun } from '@/components/icons'

type ThemeChoice = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'theme'

const options: { value: ThemeChoice; label: string; icon: React.ReactNode }[] = [
  { value: 'system', label: 'System', icon: <Monitor /> },
  { value: 'light', label: 'Light', icon: <Sun /> },
  { value: 'dark', label: 'Dark', icon: <Moon /> },
]

function applyTheme(choice: ThemeChoice) {
  let dark = false
  if (choice === 'dark') {
    dark = true
  } else if (choice === 'system') {
    dark = window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  let theme = 'light'
  if (dark) {
    theme = 'dark'
  }
  document.documentElement.dataset.theme = theme
}

const CHANGE_EVENT = 'themechoicechange'

function readChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') {
      return stored
    }
  } catch {
    return 'system'
  }
  return 'system'
}

function readServerChoice(): ThemeChoice {
  return 'system'
}

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener(CHANGE_EVENT, onChange)
  return function () {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(CHANGE_EVENT, onChange)
  }
}

export default function ThemeSwitcher() {
  const choice = useSyncExternalStore(subscribe, readChoice, readServerChoice)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(
    function () {
      applyTheme(choice)
      if (choice !== 'system') {
        return
      }
      const media = window.matchMedia('(prefers-color-scheme: dark)')
      function onSystemChange() {
        applyTheme('system')
      }
      media.addEventListener('change', onSystemChange)
      return function () {
        media.removeEventListener('change', onSystemChange)
      }
    },
    [choice]
  )

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
        localStorage.removeItem(STORAGE_KEY)
      } else {
        localStorage.setItem(STORAGE_KEY, next)
      }
    } catch {
      applyTheme(next)
      return
    }
    window.dispatchEvent(new Event(CHANGE_EVENT))
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
