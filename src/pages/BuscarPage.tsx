import { useState } from 'react'
import { useBusqueda } from '../hooks/useBusqueda'
import { useTemas } from '../hooks/useTemas'
import type { FiltrosBusqueda } from '../types/dtos'
import SoftwareList from '../components/software/SoftwareList'

// ---------------------------------------------------------------------------
// BuscarPage — five-state search page (idle → loading → error / no-results / results).
// Filter state persists across searches (never resets after submit).
// T4: form + state machine only; voice integration added in T5.
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

export default function BuscarPage() {
  const { results, loading, error, hasSearched, buscar } = useBusqueda()
  const [form, setForm] = useState<FormState>(initialForm)
  const temas = useTemas()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    buscar(buildFiltros(form))
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-text">Buscar</h1>

      {/* Filter form card */}
      <form
        onSubmit={handleSubmit}
        className="bg-surface rounded-lg p-4 flex flex-col gap-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Texto — spans both columns */}
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
                value={form.texto}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, texto: e.target.value }))
                }}
                className="flex-1 bg-bg border border-surface rounded px-3 py-2 text-text placeholder-muted focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Tema select */}
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
              onChange={(e) =>
                setForm((prev) => ({ ...prev, temaId: e.target.value }))
              }
              className="bg-bg border border-surface rounded px-3 py-2 text-text focus:outline-none focus:border-accent"
            >
              <option value="">Todos los temas</option>
              {temas.data.map((tema) => (
                <option key={tema.id} value={tema.id}>
                  {tema.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Licencia */}
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
              onChange={(e) =>
                setForm((prev) => ({ ...prev, licencia: e.target.value }))
              }
              className="bg-bg border border-surface rounded px-3 py-2 text-text placeholder-muted focus:outline-none focus:border-accent"
            />
          </div>

          {/* Año desde */}
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
              onChange={(e) =>
                setForm((prev) => ({ ...prev, anioDesde: e.target.value }))
              }
              className="bg-bg border border-surface rounded px-3 py-2 text-text placeholder-muted focus:outline-none focus:border-accent"
            />
          </div>

          {/* Año hasta */}
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
              onChange={(e) =>
                setForm((prev) => ({ ...prev, anioHasta: e.target.value }))
              }
              className="bg-bg border border-surface rounded px-3 py-2 text-text placeholder-muted focus:outline-none focus:border-accent"
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

        {/* Loading */}
        {hasSearched && loading && (
          <p className="text-muted">Buscando…</p>
        )}

        {/* Error */}
        {hasSearched && !loading && error !== null && (
          <div className="flex flex-col gap-2">
            <p className="text-muted">No se pudieron cargar los datos</p>
            <button
              type="button"
              onClick={() => buscar(buildFiltros(form))}
              className="text-accent hover:text-text self-start transition-colors"
            >
              Reintentar
            </button>
          </div>
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
