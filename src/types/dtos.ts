import type { Tables } from './database.types'

// ---------------------------------------------------------------------------
// Primitive union types
// ---------------------------------------------------------------------------

export type ContenidoTipo = 'software' | 'tema' | 'clasificacion_si' | 'publicacion'

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

// embedding and fts are internal ML columns; consumers must never see them.
export type Software = Omit<Tables<'software'>, 'embedding' | 'fts'>

// ClasificacionSI narrows `enlaces` from raw Json to Enlace[].
// The service layer is responsible for the JSON.parse cast at the read boundary.
export type ClasificacionSI = Omit<Tables<'clasificaciones_si'>, 'enlaces'> & {
  enlaces: Enlace[]
}

export type CriterioSI = Tables<'criterios_si'>

export type ClasificacionConCriterio = ClasificacionSI & { criterio: CriterioSI }

// Publicacion narrows `enlaces` from raw Json to Enlace[] (identical narrowing to
// ClasificacionSI) and `imagenes` from raw Json to string[] (an ordered gallery of
// public Storage URLs). The service layer parses both jsonb columns at the read
// boundary (toPublicacion). A single combined Omit narrows both columns at once.
export type Publicacion = Omit<Tables<'publicaciones'>, 'enlaces' | 'imagenes'> & {
  enlaces: Enlace[]
  imagenes: string[]
}

// Composed read type: a Publicacion plus its resolved author display name
// (sourced from v_autores_publicos, never from a direct profiles join).
export type PublicacionConAutor = Publicacion & { autorNombre: string }

// Valoracion narrows `contenido_tipo` from string to the known union.
export type Valoracion = Omit<Tables<'valoraciones'>, 'contenido_tipo'> & {
  contenido_tipo: ContenidoTipo
}

export type TemaForo = Tables<'temas_foro'>

export type MensajeForo = Tables<'mensajes_foro'>

// Forum debate scope — a debate may be anchored to AT MOST ONE catalog
// dimension (a herramienta/software, a tema, or a "sí"/clasificacion_si), or
// stay general (null). The three temas_foro columns are mutually exclusive,
// enforced at the DB by the temas_foro_scope_at_most_one CHECK (migration 024).
export type ForoScopeTipo = 'software' | 'tema' | 'clasificacion_si'

// Resolved scope for display: the dimension plus the target entity's id, nombre
// (badge label) and slug (link to its detail page).
export type ForoScope = {
  tipo: ForoScopeTipo
  id: string
  nombre: string
  slug: string
}

// Filter for a scoped foro view (e.g. /foro?scope_tipo=software&scope_id=…).
export type ForoFiltro = {
  tipo: ForoScopeTipo
  id: string
}

// Composed read types: a foro row plus its resolved author display name
// (sourced from v_autores_publicos, mirroring PublicacionConAutor). temas_foro
// additionally carries its resolved scope (null for general debates).
export type TemaForoConAutor = TemaForo & {
  autorNombre: string
  scope: ForoScope | null
}

export type MensajeForoConAutor = MensajeForo & { autorNombre: string }

// Evento narrows `tipo` to EventoTipo and `metadata` from Json to a typed record.
export type Evento = Omit<Tables<'eventos'>, 'tipo' | 'metadata'> & {
  tipo: EventoTipo
  metadata: Record<string, unknown>
}

export type ProgresoRoadmap = Tables<'progreso_roadmap'>

// A roadmap stage: a tema plus its top featured software (rating-ranked).
export type EtapaRoadmap = {
  tema: Tema
  destacados: Software[]
}

// ---------------------------------------------------------------------------
// Asistente (Gemini-grounded chat) DTOs
// ---------------------------------------------------------------------------

export type AsistenteRol = 'user' | 'assistant'

export type AsistenteMensaje = {
  role: AsistenteRol
  text: string
  fuentes?: string[]
}

export type AsistenteRequest = {
  pregunta: string
  historial?: { role: AsistenteRol; text: string }[]
  pagina?: string
}

export type AsistenteResponse = {
  respuesta: string
  fuentes: string[]
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

// PublicacionRating mirrors SoftwareRating (non-null coalesced view shape) for the
// publicaciones rating leaderboard (v_publicaciones_rating). cantidad_votos keeps
// the view column name, identical to SoftwareRating's rationale above.
export type PublicacionRating = {
  publicacion_id: string
  titulo: string
  slug: string
  promedio: number
  cantidad_votos: number
}

// Views raw rows for internal service use (the generated Tables helper
// resolves view names as well as table names)
export type SoftwareRatingRow = Tables<'v_software_rating'>
export type SoftwarePopularRow = Tables<'v_software_populares'>
export type PublicacionRatingRow = Tables<'v_publicaciones_rating'>

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

// ---------------------------------------------------------------------------
// Busqueda Inteligente — Edge Function buscar request/response contract
// ---------------------------------------------------------------------------

export type FiltrosExtraidos = {
  tema_id?: string
  licencia?: string
  anio_desde?: number
  anio_hasta?: number
}

export type BusquedaInteligenteRequest = {
  texto: string
  filtros?: FiltrosExtraidos
}

export type BusquedaInteligenteResponse = {
  resultados: Software[]
  filtros_aplicados: FiltrosExtraidos
  intent_usado: boolean
}

export type NuevaValoracion = {
  contenido_tipo: ContenidoTipo
  contenido_id: string
  puntaje: number
}

export type NuevoTemaForo = {
  titulo: string
  cuerpo?: string
  // At most one scope target (mutually exclusive) — omit all three for a
  // general debate. The DB CHECK rejects setting more than one.
  software_id?: string | null
  tema_id?: string | null
  clasificacion_si_id?: string | null
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
