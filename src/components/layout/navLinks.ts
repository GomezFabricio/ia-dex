// ---------------------------------------------------------------------------
// PRIMARY_LINKS — the single set of destinations shown in the sidebar.
// Catálogo and Clasificaciones are the entry points into the content taxonomy
// (their pages list temas / clasificaciones), so the sidebar stays clean.
// ---------------------------------------------------------------------------

export type PrimaryLink = {
  to: string
  label: string
  end: boolean
  badge?: string
}

export const PRIMARY_LINKS: PrimaryLink[] = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/roadmap', label: 'Roadmap', end: false, badge: 'NUEVO' },
  { to: '/catalogo', label: 'Catálogo', end: false },
  { to: '/clasificaciones', label: 'Clasificaciones', end: false },
  { to: '/buscar', label: 'Buscar', end: false },
  { to: '/foro', label: 'Foro', end: false },
  { to: '/estadisticas', label: 'Estadísticas', end: false },
]
