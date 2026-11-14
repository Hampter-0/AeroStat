export const themeInitScript = `(function () {
  let choice = 'system'
  try {
    var stored = localStorage.getItem('theme')
    if (stored === 'light' || stored === 'dark') {
      choice = stored
    }
  } catch {}
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
})()`
