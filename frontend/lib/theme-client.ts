export type ThemeChoice = 'system' | 'light' | 'dark'

export const THEME_STORAGE_KEY = 'theme'

export const THEME_CHANGE_EVENT = 'themechoicechange'

export function applyTheme(choice: ThemeChoice) {
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

export function readChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') {
      return stored
    }
  } catch {
    return 'system'
  }
  return 'system'
}

export function readServerChoice(): ThemeChoice {
  return 'system'
}

export function subscribeToChoice(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener(THEME_CHANGE_EVENT, onChange)
  return function () {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(THEME_CHANGE_EVENT, onChange)
  }
}
