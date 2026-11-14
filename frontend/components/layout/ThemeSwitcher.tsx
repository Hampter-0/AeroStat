'use client'

import { useEffect, useRef, useState } from 'react'
import { Chevron, Monitor, Moon, Sun } from '@/components/icons'

type ThemeChoice = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'theme'

const options: { value: ThemeChoice; label: string; icon: React.ReactNode }[] = [
  { value: 'system', label: 'System', icon: <Monitor /> },
  { value: 'light', label: 'Light', icon: <Sun /> },
  { value: 'dark', label: 'Dark', icon: <Moon /> },
]

function applyTheme(choice: ThemeChoice) {
  var dark = false
  if (choice === 'dark') {
    dark = true
  } else if (choice === 'system') {
    dark = window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  var theme = 'light'
  if (dark) {
    theme = 'dark'
  }
  document.documentElement.dataset.theme = theme
}

export default function ThemeSwitcher() {
  const [choice, setChoice] = useState<ThemeChoice>('system')
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(function () {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'light' || stored === 'dark') {
        setChoice(stored)
      }
    } catch (error) {
      return
    }
  }, [])

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
    setChoice(next)
    setOpen(false)
    try {
      if (next === 'system') {
        localStorage.removeItem(STORAGE_KEY)
      } else {
        localStorage.setItem(STORAGE_KEY, next)
      }
    } catch (error) {
      return
    }
  }

  function toggleOpen() {
    setOpen(!open)
  }

  var current = options[0]
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
            var className = ''
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
