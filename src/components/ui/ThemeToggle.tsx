import { useTheme } from '../../hooks/useTheme'

// ---------------------------------------------------------------------------
// ThemeToggle — sun/moon switch between light and dark mode.
// Shows the icon of the theme you'd switch TO.
//   variant="bar" — square button for the desktop topbar.
//   variant="fab" — round floating button for the mobile thumb-zone cluster.
// ---------------------------------------------------------------------------

type Props = {
  variant?: 'bar' | 'fab'
}

export default function ThemeToggle({ variant = 'bar' }: Props) {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

  const base =
    variant === 'fab'
      ? 'grid h-14 w-14 place-items-center rounded-full border border-border bg-surface text-text shadow-pop transition-colors hover:border-accent/60'
      : 'grid h-10 w-10 place-items-center rounded-lg border border-border bg-surface text-muted shadow-card transition-colors hover:border-accent/60 hover:text-text'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={isDark ? 'Modo claro' : 'Modo oscuro'}
      className={base}
    >
      {isDark ? (
        // sun
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        // moon
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  )
}
