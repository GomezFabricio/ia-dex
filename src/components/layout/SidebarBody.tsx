import { Link, NavLink } from 'react-router-dom'
import { PRIMARY_LINKS } from './navLinks'
import SidebarAuth from './SidebarAuth'
import Logo from './Logo'

// ---------------------------------------------------------------------------
// SidebarBody — the single navigation surface (desktop rail + mobile drawer).
// Brand → profile card → destinations. Content taxonomy (temas, clasificaciones)
// is reached through its own pages, keeping the sidebar clean.
// Faint dividers separate brand / profile / nav. Brand sits on the side the
// surface enters from: left on desktop, right on mobile.
//   onNavigate — close the mobile drawer on link click.
// ---------------------------------------------------------------------------

type Props = {
  onNavigate?: () => void
}

const iconAttrs = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

const DEST_ICONS: Record<string, React.ReactNode> = {
  '/': <svg {...iconAttrs}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></svg>,
  '/catalogo': <svg {...iconAttrs}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>,
  '/clasificaciones': <svg {...iconAttrs}><path d="M12 2 2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5M2 12l10 5 10-5" /></svg>,
  '/buscar': <svg {...iconAttrs}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>,
  '/foro': <svg {...iconAttrs}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  '/estadisticas': <svg {...iconAttrs}><path d="M3 3v18h18" /><rect x="7" y="11" width="3" height="6" /><rect x="13" y="7" width="3" height="10" /></svg>,
}

const destLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
    isActive
      ? 'bg-surface font-medium text-text'
      : 'text-muted hover:bg-surface/50 hover:text-text',
  ].join(' ')

export default function SidebarBody({ onNavigate }: Props) {
  return (
    <div className="flex h-full flex-col">
      {/* Brand — centered */}
      <div className="flex shrink-0 justify-center border-b border-border/60 px-5 py-5">
        <Link to="/" onClick={onNavigate} aria-label="IA-dex — inicio" className="inline-flex transition-opacity hover:opacity-90">
          <Logo size="lg" />
        </Link>
      </div>

      {/* Profile card */}
      <div className="shrink-0 border-b border-border/60 p-4">
        <SidebarAuth onAction={onNavigate} />
      </div>

      {/* Destinations */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-4">
        {PRIMARY_LINKS.map((link) => (
          <NavLink key={link.to} to={link.to} end={link.end} onClick={onNavigate} className={destLinkClass}>
            <span className="shrink-0">{DEST_ICONS[link.to]}</span>
            {link.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
