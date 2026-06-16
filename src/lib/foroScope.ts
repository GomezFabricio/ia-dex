import type { ForoScope, ForoScopeTipo } from '../types/dtos'

// ---------------------------------------------------------------------------
// foroScope — shared label + link helpers for a debate's scope dimension.
// Keeps the dimension → human label and dimension → detail-page route mapping
// in one place (used by ForoPage, TemaForoItem, ForoTemaPage, DebatesSobreEsto).
// ---------------------------------------------------------------------------

export const scopeLabel = (tipo: ForoScopeTipo): string =>
  tipo === 'software' ? 'Herramienta' : tipo === 'tema' ? 'Tema' : 'Sí'

// Route to the scoped entity's detail page.
export const scopeHref = (scope: ForoScope): string =>
  scope.tipo === 'software'
    ? `/software/${scope.slug}`
    : scope.tipo === 'tema'
      ? `/catalogo/${scope.slug}`
      : `/clasificaciones/${scope.slug}`

// Route to the foro filtered to a given scope target.
export const foroFiltroHref = (tipo: ForoScopeTipo, id: string): string =>
  `/foro?scope_tipo=${tipo}&scope_id=${encodeURIComponent(id)}`
