import { useEffect, useState } from 'react'

// ---------------------------------------------------------------------------
// useMediaQuery — subscribe to a CSS media query and re-render on change.
// Used to mount the desktop rail OR the mobile drawer (never both), so the
// sidebar's data hooks only fetch once.
// ---------------------------------------------------------------------------

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])

  return matches
}
