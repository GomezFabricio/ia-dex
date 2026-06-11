import { useEffect, useState } from 'react'

// ---------------------------------------------------------------------------
// useTheme — light/dark theme controller.
// Strategy (per modern-web-guidance "dark-mode"): the document follows the
// system preference by default; once the user picks a theme it is pinned in
// localStorage. Colors switch via CSS `light-dark()` driven by `color-scheme`,
// which we set on <html>. An inline script in index.html applies the pinned
// value before first paint to avoid a flash.
// ---------------------------------------------------------------------------

export type Theme = 'light' | 'dark'

function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function storedTheme(): Theme | null {
  const t = localStorage.getItem('theme')
  return t === 'light' || t === 'dark' ? t : null
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => storedTheme() ?? systemTheme())

  // Follow live system changes only while the user hasn't pinned a choice.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (!storedTheme()) setTheme(mq.matches ? 'dark' : 'light')
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Apply the theme: the `.light` class drives the CSS token overrides, and
  // color-scheme themes native UI (scrollbars, form controls, autofill).
  useEffect(() => {
    const el = document.documentElement
    el.style.colorScheme = theme
    el.classList.toggle('light', theme === 'light')
  }, [theme])

  const toggle = () => {
    setTheme((cur) => {
      const next: Theme = cur === 'dark' ? 'light' : 'dark'
      localStorage.setItem('theme', next)
      return next
    })
  }

  return { theme, toggle }
}
