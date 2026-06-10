import type { Tables } from './database.types'

// ---------------------------------------------------------------------------
// Primitive union types
// ---------------------------------------------------------------------------

export type ContenidoTipo = 'software' | 'tema' | 'clasificacion_si'

export type EventoTipo = 'vista' | 'busqueda' | 'click_enlace'

// ---------------------------------------------------------------------------
// Enlace — structural type for ClasificacionSI.enlaces (stored as jsonb)
// ---------------------------------------------------------------------------

export type Enlace = {
  titulo: string
  url: string
}

// ---------------------------------------------------------------------------
// Domain DTOs (derived from Row types to guarantee zero drift with the schema)
// ---------------------------------------------------------------------------

export type Tema = Tables<'temas'>

export type Software = Tables<'software'>

// ClasificacionSI narrows `enlaces` from raw Json to Enlace[].
// The service layer is responsible for the JSON.parse cast at the read boundary.
export type ClasificacionSI = Omit<Tables<'clasificaciones_si'>, 'enlaces'> & {
  enlaces: Enlace[]
}

// Valoracion narrows `contenido_tipo` from string to the known union.
export type Valoracion = Omit<Tables<'valoraciones'>, 'contenido_tipo'> & {
  contenido_tipo: ContenidoTipo
}

export type TemaForo = Tables<'temas_foro'>

export type MensajeForo = Tables<'mensajes_foro'>

// Evento narrows `tipo` to EventoTipo and `metadata` from Json to a typed record.
export type Evento = Omit<Tables<'eventos'>, 'tipo' | 'metadata'> & {
  tipo: EventoTipo
  metadata: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// View DTOs (non-null coalesced shapes — see D3 in design)
//
// Note on cantidad_votos vs cantidad:
//   - SoftwareRating.cantidad_votos mirrors the view column name (v_software_rating).
//   - valoracionesService.promedio() returns { promedio, cantidad } — a different
//     contract because it is a polymorphic aggregate over 3 contenido_tipo values,
//     not restricted to software. The two shapes serve different use-cases.
// ---------------------------------------------------------------------------

export type SoftwareRating = {
  software_id: string
  nombre: string
  promedio: number
  cantidad_votos: number
}

export type SoftwarePopular = {
  software_id: string
  nombre: string
  vistas: number
}

// Views raw rows for internal service use (the generated Tables helper
// resolves view names as well as table names)
export type SoftwareRatingRow = Tables<'v_software_rating'>
export type SoftwarePopularRow = Tables<'v_software_populares'>

// ---------------------------------------------------------------------------
// Filter / input types
// ---------------------------------------------------------------------------

export type FiltrosBusqueda = {
  texto?: string
  tema_id?: string
  licencia?: string
  anio_desde?: number
  anio_hasta?: number
}

export type NuevaValoracion = {
  contenido_tipo: ContenidoTipo
  contenido_id: string
  puntaje: number
}

export type NuevoTemaForo = {
  titulo: string
  cuerpo?: string
}

export type NuevoMensaje = {
  tema_foro_id: string
  contenido: string
}

export type NuevoEvento = {
  tipo: EventoTipo
  software_id?: string
  metadata?: Record<string, unknown>
}
