'use client'

import { useEffect } from 'react'
import { applyTheme, readChoice, subscribeToChoice } from '@/lib/theme-client'

export default function ThemeSync() {
  useEffect(function () {
    function sync() {
      applyTheme(readChoice())
    }

    sync()

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', sync)
    const unsubscribe = subscribeToChoice(sync)

    return function () {
      media.removeEventListener('change', sync)
      unsubscribe()
    }
  }, [])

  return null
}
