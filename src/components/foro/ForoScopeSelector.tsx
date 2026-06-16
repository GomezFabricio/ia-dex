import { useMemo } from 'react'
import { useSoftwareTodos } from '../../hooks/useSoftwareTodos'
import { useTemas } from '../../hooks/useTemas'
import { useClasificaciones } from '../../hooks/useClasificaciones'
import type { ForoScopeTipo } from '../../types/dtos'

// ---------------------------------------------------------------------------
// ForoScopeSelector — picks the (optional) scope of a new debate: a herramienta
// (software), a tema, a "sí" (clasificacion_si), or General (no scope).
// Two cascading selects: dimension → entity. A debate is anchored to AT MOST
// one dimension, so choosing a dimension resets the entity. Mounted only inside
// the open create modal, so its three catalog fetches are lazy.
// ---------------------------------------------------------------------------

export type ScopeValue = { tipo: ForoScopeTipo | null; id: string | null }

type Props = {
  value: ScopeValue
  onChange: (value: ScopeValue) => void
  disabled?: boolean
}

const DIMENSIONES: { tipo: ForoScopeTipo; label: string }[] = [
  { tipo: 'software', label: 'Herramienta' },
  { tipo: 'tema', label: 'Tema' },
  { tipo: 'clasificacion_si', label: 'Sí (clasificación)' },
]

const selectClass =
  'mt-1 rounded-md border border-border bg-bg px-3 py-2 text-text transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-50'

export default function ForoScopeSelector({ value, onChange, disabled = false }: Props) {
  const software = useSoftwareTodos()
  const temas = useTemas()
  const clasificaciones = useClasificaciones()

  // Group clasificaciones by criterio axis for an <optgroup> list.
  const clasifPorCriterio = useMemo(() => {
    const byAxis = new Map<string, { criterio: string; items: { id: string; nombre: string }[] }>()
    for (const c of clasificaciones.data) {
      const key = c.criterio.id
      if (!byAxis.has(key)) byAxis.set(key, { criterio: c.criterio.nombre, items: [] })
      byAxis.get(key)!.items.push({ id: c.id, nombre: c.nombre })
    }
    return [...byAxis.values()]
  }, [clasificaciones.data])

  const handleDimension = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const raw = e.target.value
    onChange({ tipo: raw === '' ? null : (raw as ForoScopeTipo), id: null })
  }

  const handleEntity = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ tipo: value.tipo, id: e.target.value === '' ? null : e.target.value })
  }

  const entidadCargando =
    (value.tipo === 'software' && software.loading) ||
    (value.tipo === 'tema' && temas.loading) ||
    (value.tipo === 'clasificacion_si' && clasificaciones.loading)

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm text-muted">
        ¿Sobre qué querés debatir?
        <select
          value={value.tipo ?? ''}
          onChange={handleDimension}
          disabled={disabled}
          className={selectClass}
        >
          <option value="">General (sin tema específico)</option>
          {DIMENSIONES.map((d) => (
            <option key={d.tipo} value={d.tipo}>
              {d.label}
            </option>
          ))}
        </select>
      </label>

      {value.tipo !== null && (
        <label className="flex flex-col gap-1 text-sm text-muted">
          {value.tipo === 'software'
            ? 'Elegí la herramienta'
            : value.tipo === 'tema'
              ? 'Elegí el tema'
              : 'Elegí la clasificación'}
          <select
            value={value.id ?? ''}
            onChange={handleEntity}
            disabled={disabled || entidadCargando}
            required
            className={selectClass}
          >
            <option value="">{entidadCargando ? 'Cargando opciones…' : 'Elegí una opción'}</option>

            {value.tipo === 'software' &&
              software.data.map((sw) => (
                <option key={sw.id} value={sw.id}>
                  {sw.nombre}
                </option>
              ))}

            {value.tipo === 'tema' &&
              temas.data.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}

            {value.tipo === 'clasificacion_si' &&
              clasifPorCriterio.map((grupo) => (
                <optgroup key={grupo.criterio} label={grupo.criterio}>
                  {grupo.items.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </optgroup>
              ))}
          </select>
        </label>
      )}
    </div>
  )
}
