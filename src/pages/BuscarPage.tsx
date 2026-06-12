import { useCallback, useRef, useState } from 'react'
import { useBusqueda } from '../hooks/useBusqueda'
import { useTemas } from '../hooks/useTemas'
import { useVoz } from '../hooks/useVoz'
import type { FiltrosBusqueda, FiltrosExtraidos } from '../types/dtos'
import SoftwareList from '../components/software/SoftwareList'
import VoiceSearchOverlay from '../components/busqueda/VoiceSearchOverlay'

// ---------------------------------------------------------------------------
// BuscarPage — hybrid NLP search page.
//
// texto is the primary driver. Submitting a non-empty texto calls the buscar
// Edge Function (Gemini intent + semantic hybrid). The EF returns extracted
// filters which are mirrored into the form controls so users can see and refine them.
//
// Manual filter edits after a hybrid search re-run the search with those values
// as hard constraints (manual wins over extracted, per design).
//
// Voice: transcript → same pipeline via handleTranscript (useVoz unchanged).
//
// Loading: previous results are kept visible during a new fetch (no flash).
// Fallback: when EF fails and ilike is used, a subtle non-blocking notice appears.
// Error: shown only when even the ilike fallback fails.
// ---------------------------------------------------------------------------

type FormState = {
  texto: string
  temaId: string
  licencia: string
  anioDesde: string
  anioHasta: string
}

const initialForm: FormState = {
  texto: '',
  temaId: '',
  licencia: '',
  anioDesde: '',
  anioHasta: '',
}

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
function applyFiltrosExtraidos(
  prev: FormState,
  filtros: FiltrosExtraidos,
): FormState {
  return {
    ...prev,
    ...(filtros.tema_id !== undefined ? { temaId: filtros.tema_id } : {}),
    ...(filtros.licencia !== undefined ? { licencia: filtros.licencia } : {}),
    ...(filtros.anio_desde !== undefined
      ? { anioDesde: String(filtros.anio_desde) }
      : {}),
    ...(filtros.anio_hasta !== undefined
      ? { anioHasta: String(filtros.anio_hasta) }
      : {}),
  }
}

export default function BuscarPage() {
  const [form, setForm] = useState<FormState>(initialForm)
  const temas = useTemas()

  // onFiltrosExtraidos is called by useBusqueda after a successful hybrid search.
  // It runs inside the async callback chain (not inside an effect), so setState
  // here is safe and won't trigger the react-hooks/set-state-in-effect rule.
  // Wrapped in useCallback with [] deps because it only uses setForm (stable).
  const onFiltrosExtraidos = useCallback((filtros: FiltrosExtraidos) => {
    setForm((prev) => applyFiltrosExtraidos(prev, filtros))
  }, [])

  const { results, loading, error, hasSearched, usoFallback, buscar } =
    useBusqueda({ onFiltrosExtraidos })

  // lastSearchedFiltrosRef holds the serialized filtros from the most recent buscar()
  // call. Used by handleTextFilterBlur to skip no-op re-searches when the committed
  // value matches what was already searched.
  const lastSearchedFiltrosRef = useRef<string>('')

  // lastSearchedTextoRef holds the trimmed texto of the most recent search.
  // A submit/transcript whose texto DIFFERS starts a clean search: stale filters
  // (auto-extracted or manual) are cleared so they don't constrain the new intent
  // as hard filters; the new extraction repopulates the controls.
  const lastSearchedTextoRef = useRef<string>('')

  // Wraps buscar() and records what was searched so blur handlers can detect no-ops.
  const buscarAndRecord = (nextForm: FormState) => {
    const texto = nextForm.texto.trim()
    const isNewTexto = texto !== '' && texto !== lastSearchedTextoRef.current
    const searchForm = isNewTexto
      ? { ...initialForm, texto: nextForm.texto }
      : nextForm
    setForm(searchForm)
    lastSearchedTextoRef.current = texto
    const filtros = buildFiltros(searchForm)
    lastSearchedFiltrosRef.current = JSON.stringify(filtros)
    buscar(filtros)
  }

  // D3+D4: handleTranscript passes {...form, texto: transcript} directly so the
  // search doesn't depend on the pending setForm flush (no stale closure).
  // buscarAndRecord applies the new-texto filter reset, same as a manual submit.
  const handleTranscript = (transcript: string) => {
    buscarAndRecord({ ...form, texto: transcript })
  }

  const voz = useVoz(handleTranscript)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    buscarAndRecord(form)
  }

  // For the tema <select>: re-search immediately on every change (fires once per
  // selection — no keystroke spam risk). Re-runs with updated hard constraints.
  const handleSelectFilterChange = (patch: Partial<FormState>) => {
    const nextForm = { ...form, ...patch }
    setForm(nextForm)
    if (hasSearched) {
      buscarAndRecord(nextForm)
    }
  }

  // For text / number inputs (licencia, año desde, año hasta): update form state on
  // every keystroke via onChange but defer the re-search to onBlur (commit semantics).
  // On blur, only re-search if the committed value actually differs from the last
  // searched value to avoid no-op blur re-searches.
  const handleTextFilterChange = (patch: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  const handleTextFilterBlur = (patch: Partial<FormState>) => {
    if (!hasSearched) return
    // Compute nextForm from the CURRENT form snapshot (the input's e.target.value
    // is captured in patch so we don't need a state-updater closure for the diff check).
    const nextForm = { ...form, ...patch }
    setForm(nextForm)
    const filtros = buildFiltros(nextForm)
    if (JSON.stringify(filtros) !== lastSearchedFiltrosRef.current) {
      lastSearchedFiltrosRef.current = JSON.stringify(filtros)
      buscar(filtros)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-text">Buscar</h1>

      {/* Listening overlay — open while recognition runs; cancel stops it.
          Closes automatically when a transcript arrives or recognition ends
          (isListening goes false), and on Esc / backdrop click via Modal. */}
      <VoiceSearchOverlay
        open={voz.isListening}
        speaking={voz.isSpeaking}
        onCancel={voz.stop}
      />

      {/* Filter form card */}
      <form
        onSubmit={handleSubmit}
        className="bg-surface rounded-lg p-4 flex flex-col gap-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Texto — primary search driver, spans both columns */}
          <div className="sm:col-span-2 flex flex-col gap-1">
            <label
              htmlFor="buscar-texto"
              className="text-sm text-muted"
            >
              Texto
            </label>
            <div className="flex gap-2 items-center">
              <input
                id="buscar-texto"
                type="text"
                aria-label="Buscar software"
                placeholder="Ej: herramientas gratuitas para procesamiento de lenguaje natural"
                value={form.texto}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, texto: e.target.value }))
                  voz.clearError()
                }}
                className="flex-1 bg-bg border border-border rounded px-3 py-2 text-text placeholder-muted focus:outline-none focus:border-accent"
              />
              {/* Mic button — rendered only when voice is supported (Spec 2) */}
              {voz.isSupported && (
                <>
                  <button
                    type="button"
                    aria-label={
                      voz.isListening
                        ? 'Detener búsqueda por voz'
                        : 'Activar búsqueda por voz'
                    }
                    onClick={() => {
                      if (voz.isListening) {
                        voz.stop()
                      } else {
                        voz.start()
                      }
                    }}
                    className={
                      voz.isListening
                        ? 'text-error animate-pulse border border-border rounded p-2'
                        : 'text-muted border border-border rounded p-2 hover:text-text transition-colors'
                    }
                  >
                    {/* Inline microphone SVG — no icon dependency */}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" x2="12" y1="19" y2="22" />
                    </svg>
                  </button>
                </>
              )}
            </div>
            {/* Voice error — displayed inline below the texto input */}
            {voz.error !== null && (
              <p className="text-error text-sm">{voz.error}</p>
            )}
            {/* Unsupported hint — shown only when voice is not available */}
            {!voz.isSupported && (
              <p className="text-sm text-muted">
                Búsqueda por voz disponible en Chrome o Edge.
              </p>
            )}
          </div>

          {/* Tema select — re-search fires immediately on change (single event per selection) */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="buscar-tema"
              className="text-sm text-muted"
            >
              Tema
            </label>
            <select
              id="buscar-tema"
              value={form.temaId}
              onChange={(e) => handleSelectFilterChange({ temaId: e.target.value })}
              className="bg-bg border border-border rounded px-3 py-2 text-text focus:outline-none focus:border-accent"
            >
              <option value="">Todos los temas</option>
              {temas.data.map((tema) => (
                <option key={tema.id} value={tema.id}>
                  {tema.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Licencia — onChange updates state only; onBlur commits and re-searches if changed */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="buscar-licencia"
              className="text-sm text-muted"
            >
              Licencia
            </label>
            <input
              id="buscar-licencia"
              type="text"
              placeholder="ej. MIT"
              value={form.licencia}
              onChange={(e) => handleTextFilterChange({ licencia: e.target.value })}
              onBlur={(e) => handleTextFilterBlur({ licencia: e.target.value })}
              className="bg-bg border border-border rounded px-3 py-2 text-text placeholder-muted focus:outline-none focus:border-accent"
            />
          </div>

          {/* Año desde — onChange updates state only; onBlur commits and re-searches if changed */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="buscar-anio-desde"
              className="text-sm text-muted"
            >
              Año desde
            </label>
            <input
              id="buscar-anio-desde"
              type="number"
              value={form.anioDesde}
              onChange={(e) => handleTextFilterChange({ anioDesde: e.target.value })}
              onBlur={(e) => handleTextFilterBlur({ anioDesde: e.target.value })}
              className="bg-bg border border-border rounded px-3 py-2 text-text placeholder-muted focus:outline-none focus:border-accent"
            />
          </div>

          {/* Año hasta — onChange updates state only; onBlur commits and re-searches if changed */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="buscar-anio-hasta"
              className="text-sm text-muted"
            >
              Año hasta
            </label>
            <input
              id="buscar-anio-hasta"
              type="number"
              value={form.anioHasta}
              onChange={(e) => handleTextFilterChange({ anioHasta: e.target.value })}
              onBlur={(e) => handleTextFilterBlur({ anioHasta: e.target.value })}
              className="bg-bg border border-border rounded px-3 py-2 text-text placeholder-muted focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        <button
          type="submit"
          className="self-start bg-accent text-bg rounded px-4 py-2 font-semibold hover:opacity-90 transition-opacity"
        >
          Buscar
        </button>
      </form>

      {/* Results section — five-state machine */}
      <div className="flex flex-col gap-4">
        {/* Idle */}
        {!hasSearched && (
          <p className="text-muted">Ingresá los filtros para buscar.</p>
        )}

        {/* Loading — preserve previous results, show spinner text below */}
        {hasSearched && loading && results.length > 0 && (
          <SoftwareList items={results} />
        )}
        {hasSearched && loading && (
          <p className="text-muted">Buscando…</p>
        )}

        {/* Error — only shown when both EF and fallback failed */}
        {hasSearched && !loading && error !== null && (
          <div className="flex flex-col gap-2">
            <p className="text-muted">No se pudieron cargar los datos</p>
            <button
              type="button"
              onClick={() => buscarAndRecord(form)}
              className="text-accent hover:text-text self-start transition-colors"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Fallback notice — subtle, non-blocking; shown when EF failed but ilike succeeded */}
        {hasSearched && !loading && error === null && usoFallback && (
          <p className="text-sm text-muted">
            Búsqueda semántica no disponible. Mostrando resultados por texto exacto.
          </p>
        )}

        {/* No results */}
        {hasSearched && !loading && error === null && results.length === 0 && (
          <p className="text-muted">Sin resultados.</p>
        )}

        {/* Results */}
        {hasSearched && !loading && error === null && results.length > 0 && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              {results.length === 1
                ? '1 resultado'
                : `${results.length} resultados`}
            </p>
            <SoftwareList items={results} />
          </div>
        )}
      </div>
    </div>
  )
}
