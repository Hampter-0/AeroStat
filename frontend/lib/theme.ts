export const themeInitScript = `(function () {
  var choice = 'system'
  try {
    var stored = localStorage.getItem('theme')
    if (stored === 'light' || stored === 'dark') {
      choice = stored
    }
  } catch (error) {}
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
})()`
