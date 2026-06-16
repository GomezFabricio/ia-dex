// ---------------------------------------------------------------------------
// DEST_ICONS — the line-icon set for the primary nav, keyed by route path.
// Shared by the desktop sidebar (SidebarBody) and the mobile pill (MobileNav)
// so both render the same glyphs. Kept in its own module so each consumer file
// only exports components (react-refresh friendly).
// ---------------------------------------------------------------------------

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

export const DEST_ICONS: Record<string, React.ReactNode> = {
  '/': <svg {...iconAttrs}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></svg>,
  '/roadmap': <svg {...iconAttrs}><circle cx="6" cy="19" r="2" /><circle cx="18" cy="5" r="2" /><path d="M6 17v-3a4 4 0 0 1 4-4h4a4 4 0 0 0 4-4" /></svg>,
  '/catalogo': <svg {...iconAttrs}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>,
  '/clasificaciones': <svg {...iconAttrs}><path d="M12 2 2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5M2 12l10 5 10-5" /></svg>,
  '/blog': <svg {...iconAttrs}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /><path d="M9 7h7M9 11h7" /></svg>,
  '/buscar': <svg {...iconAttrs}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>,
  '/foro': <svg {...iconAttrs}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  '/estadisticas': <svg {...iconAttrs}><path d="M3 3v18h18" /><rect x="7" y="11" width="3" height="6" /><rect x="13" y="7" width="3" height="10" /></svg>,
}
