import { useEffect, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// useCountUp — animates an integer from 0 to `target` (easeOutCubic) when the
// target becomes available. Honors prefers-reduced-motion (jumps to the value).
// Used by the Estadísticas stat cards. setState happens inside a rAF callback,
// not synchronously in the effect body.
// ---------------------------------------------------------------------------

export function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const cancel = () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }

    // No animation when there's nothing to count or motion is reduced — snap to
    // the value on the next frame (keeps setState out of the effect body).
    if (target <= 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      rafRef.current = requestAnimationFrame(() => setValue(target))
      return cancel
    }

    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(target * eased))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return cancel
  }, [target, durationMs])

  return value
}
