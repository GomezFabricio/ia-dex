// ---------------------------------------------------------------------------
// buildBreadcrumb — turn a route pathname into the dex-label trail shown in the
// scroll-reactive top chrome (e.g. "Inicio · Catálogo · Vision").
// Known first segments get a curated label; deeper param segments (tema/clasif
// slugs, ids) are humanized as a best-effort fallback. The trail always starts
// at "Inicio" since every route lives under the home layout.
// ---------------------------------------------------------------------------

const SEGMENT_LABELS: Record<string, string> = {
  roadmap: 'Roadmap',
  catalogo: 'Catálogo',
  software: 'Software',
  clasificaciones: 'Clasificaciones',
  buscar: 'Buscar',
  foro: 'Foro',
  estadisticas: 'Estadísticas',
}

// Turn a slug/id segment into readable text: "vision-artificial" → "Vision artificial".
function humanize(segment: string): string {
  const text = decodeURIComponent(segment).replace(/[-_]/g, ' ').trim()
  if (text === '') return ''
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function buildBreadcrumb(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean)
  const crumbs = ['Inicio']
  for (const seg of segments) {
    crumbs.push(SEGMENT_LABELS[seg] ?? humanize(seg))
  }
  return crumbs.filter(Boolean).join(' · ')
}
