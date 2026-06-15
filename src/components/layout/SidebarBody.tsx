import { Link, NavLink } from 'react-router-dom'
import { PRIMARY_LINKS } from './navLinks'
import { DEST_ICONS } from './navIcons'
import SidebarAuth from './SidebarAuth'
import Logo from './Logo'

// ---------------------------------------------------------------------------
// SidebarBody — the desktop navigation rail.
// Brand (top) → destinations (flex-1) → profile card (bottom), matching the
// design handoff. Active link: a soft accent wash + an inset accent edge bar.
// The icon set lives in navIcons (shared with the mobile pill).
// ---------------------------------------------------------------------------

type Props = {
  onNavigate?: () => void
}

const destLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors',
    isActive
      ? 'bg-[color-mix(in_oklab,var(--color-accent)_16%,transparent)] text-text shadow-[inset_3px_0_0_var(--color-accent)]'
      : 'text-muted hover:bg-[color-mix(in_oklab,var(--color-text)_7%,transparent)] hover:text-text',
  ].join(' ')

export default function SidebarBody({ onNavigate }: Props) {
  return (
    <div className="relative flex h-full flex-col">
      {/* Brand */}
      <div className="flex shrink-0 items-center gap-3 px-5 pb-4 pt-6">
        <Link to="/" onClick={onNavigate} aria-label="IA-dex — inicio" className="inline-flex transition-opacity hover:opacity-90">
          <Logo size="lg" />
        </Link>
      </div>

      {/* Destinations */}
      <nav className="flex flex-1 flex-col gap-[3px] overflow-y-auto px-3.5 py-2.5">
        {PRIMARY_LINKS.map((link) => (
          <NavLink key={link.to} to={link.to} end={link.end} onClick={onNavigate} className={destLinkClass}>
            <span className="shrink-0">{DEST_ICONS[link.to]}</span>
            <span className="flex-1">{link.label}</span>
            {link.badge !== undefined && (
              <span className="dex-label rounded-full bg-[image:var(--gradient-neural)] px-1.5 py-0.5 text-[8px] text-white">
                {link.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Profile card — bottom */}
      <div className="shrink-0 border-t border-border/60 p-4">
        <SidebarAuth onAction={onNavigate} />
      </div>
    </div>
  )
}
