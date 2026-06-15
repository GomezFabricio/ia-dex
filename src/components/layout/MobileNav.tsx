import { NavLink } from 'react-router-dom'
import { PRIMARY_LINKS } from './navLinks'
import { DEST_ICONS } from './navIcons'

// ---------------------------------------------------------------------------
// MobileNav — the small-screen navigation: a floating, bottom-centered icon
// pill (recreates the design handoff's `mobilenav`). Icons only — labels live in
// aria-label. Theme toggle lives in the top chrome bar; auth is action-level
// (design D3), so it isn't surfaced here. Horizontal-scrollable on very narrow
// viewports; the scrollbar is hidden via [data-rail].
// ---------------------------------------------------------------------------

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors',
    isActive
      ? 'bg-[color-mix(in_oklab,var(--color-accent)_20%,transparent)] text-text'
      : 'text-muted hover:text-text',
  ].join(' ')

export default function MobileNav() {
  return (
    <nav
      data-rail
      aria-label="Navegación"
      className="fixed bottom-4 left-1/2 z-40 flex max-w-[calc(100vw-24px)] -translate-x-1/2 gap-1 overflow-x-auto rounded-2xl border border-border bg-surface/[0.88] p-[7px] shadow-pop backdrop-blur-2xl"
    >
      {PRIMARY_LINKS.map((link) => (
        <NavLink key={link.to} to={link.to} end={link.end} aria-label={link.label} className={linkClass}>
          {DEST_ICONS[link.to]}
        </NavLink>
      ))}
    </nav>
  )
}
