import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useBusqueda } from '../hooks/useBusqueda'
import { useTemas } from '../hooks/useTemas'
import { useVoz } from '../hooks/useVoz'
import { useRecomendacionesGlobales } from '../hooks/useRecomendacionesGlobales'
import type { FiltrosBusqueda, FiltrosExtraidos, Software } from '../types/dtos'
import PosterCard from '../components/software/PosterCard'
import ContentRow from '../components/software/ContentRow'
import VoiceSearchOverlay from '../components/busqueda/VoiceSearchOverlay'

// ---------------------------------------------------------------------------
// BuscarPage — "cine-neural" hybrid NLP search (redesign).
// A centered cinematic hero (big search field + voice + inline filters); idle
// shows suggestion chips + a "Populares ahora" rail; a query shows the result
// poster grid (count / empty / fallback-notice / error states). texto drives the
// hybrid buscar EF (Gemini intent + semantic); manual filters are hard
// constraints. The ?q= param (home hero command bar) prefills + searches once.
// ---------------------------------------------------------------------------

type FormState = {
  texto: string
  temaId: string
  licencia: string
  anioDesde: string
  anioHasta: string
}

const initialForm: FormState = { texto: '', temaId: '', licencia: '', anioDesde: '', anioHasta: '' }

const SUGGESTIONS = [
  'procesamiento de lenguaje',
  'visión por computadora',
  'generativa',
  'open source',
  'aprendizaje supervisado',
]

// Maps FormState string fields to typed FiltrosBusqueda, handling NaN years and trims.
function buildFiltros(form: FormState): FiltrosBusqueda {
  const filtros: FiltrosBusqueda = {}

  const texto = form.texto.trim()
  if (texto !== '') filtros.texto = texto

  if (form.temaId !== '') filtros.tema_id = form.temaId

  const licencia = form.licencia.trim()
  if (licencia !== '') filtros.licencia = licencia

  const desde = Number.parseInt(form.anioDesde, 10)
  if (!Number.isNaN(desde)) filtros.anio_desde = desde

  const hasta = Number.parseInt(form.anioHasta, 10)
  if (!Number.isNaN(hasta)) filtros.anio_hasta = hasta

  return filtros
}

// Merges extracted filters from a hybrid search response into form state.
function applyFiltrosExtraidos(prev: FormState, filtros: FiltrosExtraidos): FormState {
  return {
    ...prev,
    ...(filtros.tema_id !== undefined ? { temaId: filtros.tema_id } : {}),
    ...(filtros.licencia !== undefined ? { licencia: filtros.licencia } : {}),
    ...(filtros.anio_desde !== undefined ? { anioDesde: String(filtros.anio_desde) } : {}),
    ...(filtros.anio_hasta !== undefined ? { anioHasta: String(filtros.anio_hasta) } : {}),
  }
}

// Results as a poster grid (mirrors the catalog/tema grid).
function ResultsGrid({
  items,
  temaNombrePorId,
}: {
  items: Software[]
  temaNombrePorId: (temaId: string) => string | undefined
}) {
  return (
    <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(165px,1fr))] gap-4">
      {items.map((sw, i) => (
        <li key={sw.id}>
          <PosterCard software={sw} dex={i + 1} temaNombre={temaNombrePorId(sw.tema_id)} />
        </li>
      ))}
    </ul>
  )
}

const fieldClass =
  'rounded-full border border-border bg-surface px-3.5 py-2 text-sm text-text placeholder-muted transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25'

export default function BuscarPage() {
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState<FormState>(() => ({
    ...initialForm,
    texto: searchParams.get('q')?.trim() ?? '',
  }))
  const temas = useTemas()
  const populares = useRecomendacionesGlobales(8)

  const onFiltrosExtraidos = useCallback((filtros: FiltrosExtraidos) => {
    setForm((prev) => applyFiltrosExtraidos(prev, filtros))
  }, [])

  const { results, loading, error, hasSearched, usoFallback, buscar } = useBusqueda({ onFiltrosExtraidos })

  const lastSearchedFiltrosRef = useRef<string>('')
  const lastSearchedTextoRef = useRef<string>('')

  const buscarAndRecord = (nextForm: FormState) => {
    const texto = nextForm.texto.trim()
    const isNewTexto = texto !== '' && texto !== lastSearchedTextoRef.current
    const searchForm = isNewTexto ? { ...initialForm, texto: nextForm.texto } : nextForm
    setForm(searchForm)
    lastSearchedTextoRef.current = texto
    const filtros = buildFiltros(searchForm)
    lastSearchedFiltrosRef.current = JSON.stringify(filtros)
    buscar(filtros)
  }

  const handleTranscript = (transcript: string) => {
    buscarAndRecord({ ...form, texto: transcript })
  }

  const voz = useVoz(handleTranscript)

  // One-shot: ?q= handed over by the home hero → run that search on mount.
  useEffect(() => {
    const q = searchParams.get('q')?.trim() ?? ''
    if (q === '') return
    lastSearchedTextoRef.current = q
    const filtros = buildFiltros({ ...initialForm, texto: q })
    lastSearchedFiltrosRef.current = JSON.stringify(filtros)
    buscar(filtros)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    buscarAndRecord(form)
  }

  const handleSelectFilterChange = (patch: Partial<FormState>) => {
    const nextForm = { ...form, ...patch }
    setForm(nextForm)
    if (hasSearched) buscarAndRecord(nextForm)
  }

  const handleTextFilterChange = (patch: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  const handleTextFilterBlur = (patch: Partial<FormState>) => {
    if (!hasSearched) return
    const nextForm = { ...form, ...patch }
    setForm(nextForm)
    const filtros = buildFiltros(nextForm)
    if (JSON.stringify(filtros) !== lastSearchedFiltrosRef.current) {
      lastSearchedFiltrosRef.current = JSON.stringify(filtros)
      buscar(filtros)
    }
  }

  // tema_id → tema.nombre resolver for the result/popular poster kickers.
  const temaNombrePorId = useMemo(() => {
    const byId = new Map(temas.data.map((t) => [t.id, t.nombre]))
    return (temaId: string) => byId.get(temaId)
  }, [temas.data])

  return (
    <div className="flex flex-col">
      <VoiceSearchOverlay open={voz.isListening} speaking={voz.isSpeaking} onCancel={voz.stop} />

      {/* Centered search hero */}
      <section className="relative flex flex-col items-center overflow-hidden px-6 pt-24 pb-8 text-center sm:px-8">
        <div
          aria-hidden="true"
          className="dex-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(80%_80%_at_50%_30%,black,transparent)]"
        />
        <div
          aria-hidden="true"
          className="orb-float pointer-events-none absolute -top-12 h-72 w-[34rem] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--color-accent)_55%,transparent),transparent_65%)] opacity-30 blur-[110px]"
        />

        <div className="relative w-full max-w-[680px]">
          <p className="dex-label mb-4 text-[11px] text-accent-2">Buscar en el índice</p>
          <h1 className="font-display mb-6 text-[clamp(1.9rem,4.5vw,3rem)] font-bold tracking-[-0.02em] text-text">
            ¿Qué querés aprender hoy?
          </h1>

          <form
            onSubmit={handleSubmit}
            role="search"
            className="flex items-center gap-3 rounded-2xl border border-border-strong bg-surface/[0.88] p-2.5 pl-5 shadow-glow backdrop-blur-md"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-accent" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              id="buscar-texto"
              type="text"
              aria-label="Buscar software"
              placeholder="Buscá software, temas o conceptos…"
              value={form.texto}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, texto: e.target.value }))
                voz.clearError()
              }}
              className="min-w-0 flex-1 border-none bg-transparent text-left text-[18px] text-text outline-none placeholder:text-muted"
            />
            {voz.isSupported && (
              <button
                type="button"
                aria-label={voz.isListening ? 'Detener búsqueda por voz' : 'Activar búsqueda por voz'}
                onClick={() => (voz.isListening ? voz.stop() : voz.start())}
                className={[
                  'grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl border border-border transition-colors',
                  voz.isListening ? 'animate-pulse bg-surface-2 text-error' : 'bg-surface-2 text-muted hover:text-text',
                ].join(' ')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM5 10v2a7 7 0 0 0 14 0v-2M12 19v3" />
                </svg>
              </button>
            )}
          </form>

          {voz.error !== null && <p className="mt-2 text-sm text-error">{voz.error}</p>}
          {!voz.isSupported && (
            <p className="mt-2 text-sm text-muted">Búsqueda por voz disponible en Chrome o Edge.</p>
          )}

          {/* Inline filters */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
            <span className="dex-label text-[9px] text-faint">Filtros:</span>
            <select
              aria-label="Filtrar por tema"
              value={form.temaId}
              onChange={(e) => handleSelectFilterChange({ temaId: e.target.value })}
              className={fieldClass}
            >
              <option value="">Todos los temas</option>
              {temas.data.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
            <input
              type="text"
              aria-label="Filtrar por licencia"
              placeholder="Licencia"
              value={form.licencia}
              onChange={(e) => handleTextFilterChange({ licencia: e.target.value })}
              onBlur={(e) => handleTextFilterBlur({ licencia: e.target.value })}
              className={`${fieldClass} w-32`}
            />
            <input
              type="number"
              aria-label="Año desde"
              placeholder="Desde"
              value={form.anioDesde}
              onChange={(e) => handleTextFilterChange({ anioDesde: e.target.value })}
              onBlur={(e) => handleTextFilterBlur({ anioDesde: e.target.value })}
              className={`${fieldClass} w-24`}
            />
            <input
              type="number"
              aria-label="Año hasta"
              placeholder="Hasta"
              value={form.anioHasta}
              onChange={(e) => handleTextFilterChange({ anioHasta: e.target.value })}
              onBlur={(e) => handleTextFilterBlur({ anioHasta: e.target.value })}
              className={`${fieldClass} w-24`}
            />
          </div>
        </div>
      </section>

      {/* Results / idle */}
      {hasSearched ? (
        <div className="mx-auto w-full max-w-[1400px] px-4 pb-16 sm:px-8">
          {loading && results.length > 0 && (
            <div className="flex flex-col gap-4">
              <p className="dex-label text-[11px] text-muted">Buscando…</p>
              <ResultsGrid items={results} temaNombrePorId={temaNombrePorId} />
            </div>
          )}
          {loading && results.length === 0 && <p className="text-muted">Buscando…</p>}

          {!loading && error !== null && (
            <div className="flex flex-col gap-2">
              <p className="text-muted">No se pudieron cargar los datos</p>
              <button type="button" onClick={() => buscarAndRecord(form)} className="self-start text-accent transition-colors hover:text-text">
                Reintentar
              </button>
            </div>
          )}

          {!loading && error === null && usoFallback && (
            <p className="mb-4 text-sm text-muted">
              Búsqueda semántica no disponible. Mostrando resultados por texto exacto.
            </p>
          )}

          {!loading && error === null && results.length === 0 && (
            <div className="py-12 text-center">
              <div className="font-display mb-2 text-xl text-text">Sin resultados</div>
              <p className="text-sm text-muted">Probá con otro término o explorá las sugerencias.</p>
            </div>
          )}

          {!loading && error === null && results.length > 0 && (
            <div className="flex flex-col gap-4">
              <p className="dex-label text-[11px] text-muted">
                {results.length === 1 ? '1 resultado' : `${results.length} resultados`}
              </p>
              <ResultsGrid items={results} temaNombrePorId={temaNombrePorId} />
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4 pb-16">
          <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-center gap-2 px-4 sm:px-8">
            <span className="dex-label text-[9px] text-faint">Sugerencias:</span>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => buscarAndRecord({ ...initialForm, texto: s })}
                className="dex-label rounded-full border border-accent/30 bg-accent/[0.12] px-3.5 py-2 text-[10px] text-accent-strong transition-colors hover:bg-accent/20"
              >
                {s}
              </button>
            ))}
          </div>
          {!populares.loading && populares.error === null && populares.data.length > 0 && (
            <ContentRow titulo="Populares ahora" items={populares.data} temaNombrePorId={temaNombrePorId} />
          )}
        </div>
      )}
    </div>
  )
}
