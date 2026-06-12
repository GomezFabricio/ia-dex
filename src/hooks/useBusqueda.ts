import { useCallback, useEffect, useReducer, useRef } from 'react'
import type { Software, FiltrosBusqueda, FiltrosExtraidos } from '../types/dtos'
import * as softwareService from '../services/softwareService'
import * as eventosService from '../services/eventosService'

// ---------------------------------------------------------------------------
// useBusqueda — hybrid-first search hook with transparent ilike fallback.
//
// Flow when texto is non-empty:
//   1. Call buscarInteligente (EF buscar) — hybrid NLP + semantic search.
//   2. On success: dispatch results; call opts.onFiltrosExtraidos with the
//      extracted filters so the page can mirror them into form controls.
//      This callback runs inside the async chain (not an effect), so callers
//      can safely call setState without triggering cascade-render rules.
//   3. On EF error: fall back to buscar() (ilike) transparently; set usoFallback.
//      error state is only set when the fallback ALSO fails.
//
// Flow when texto is empty:
//   - At least one filter → buscar() direct (current filtered-listing behavior).
//   - No texto + no filters → buscar() with empty filtros (all rows).
//
// Stale-response guard (D5): each call increments requestIdRef; only the latest
// dispatches results, preventing out-of-order updates from racing fetches.
//
// Public API shape is additive — existing consumers only used results/loading/error/
// hasSearched/buscar, all of which remain unchanged.
// ---------------------------------------------------------------------------

type State = {
  results: Software[]
  loading: boolean
  error: Error | null
  hasSearched: boolean
  usoFallback: boolean
  intentUsado: boolean
}

type Action =
  | { type: 'search' }
  | {
      type: 'success'
      payload: {
        results: Software[]
        usoFallback: boolean
        intentUsado: boolean
      }
    }
  | { type: 'error'; payload: Error }

const initialState: State = {
  results: [],
  loading: false,
  error: null,
  hasSearched: false,
  usoFallback: false,
  intentUsado: false,
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'search':
      // Keep previous results visible during loading (spec: no flash to empty).
      return { ...state, loading: true, error: null, hasSearched: true }
    case 'success':
      return {
        ...state,
        loading: false,
        results: action.payload.results,
        usoFallback: action.payload.usoFallback,
        intentUsado: action.payload.intentUsado,
      }
    case 'error':
      // results retain their previous value on error (spec: not reset).
      return { ...state, loading: false, error: action.payload }
  }
}

// Builds analytics metadata with only non-empty / non-undefined fields (Spec 1 scenario 4).
function buildMetadata(filtros: FiltrosBusqueda): Record<string, unknown> {
  const metadata: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(filtros)) {
    if (value !== undefined && value !== '') {
      metadata[key] = value
    }
  }
  return metadata
}

// Extracts the hard filter fields (non-text) from FiltrosBusqueda into FiltrosExtraidos.
// Manual filters sent by the caller are HARD constraints — they override extracted ones.
function toFiltrosEF(filtros: FiltrosBusqueda): FiltrosExtraidos {
  const f: FiltrosExtraidos = {}
  if (filtros.tema_id !== undefined) f.tema_id = filtros.tema_id
  if (filtros.licencia !== undefined) f.licencia = filtros.licencia
  if (filtros.anio_desde !== undefined) f.anio_desde = filtros.anio_desde
  if (filtros.anio_hasta !== undefined) f.anio_hasta = filtros.anio_hasta
  return f
}

export type UseBusquedaOptions = {
  /**
   * Called after a successful hybrid search when the EF returns extracted filters.
   * Runs inside the async callback chain (not an effect), so callers can safely
   * call setState here without violating the react-hooks/set-state-in-effect rule.
   */
  onFiltrosExtraidos?: (filtros: FiltrosExtraidos) => void
}

export type UseBusquedaReturn = {
  results: Software[]
  loading: boolean
  error: Error | null
  hasSearched: boolean
  usoFallback: boolean
  intentUsado: boolean
  buscar: (filtros: FiltrosBusqueda) => void
}

export function useBusqueda(opts: UseBusquedaOptions = {}): UseBusquedaReturn {
  const [state, dispatch] = useReducer(reducer, initialState)
  // D5: stale-response guard — only the latest request dispatches results.
  const requestIdRef = useRef(0)
  // Keep opts stable without needing them in the useCallback dep array.
  // Updated in a useEffect (not during render) to satisfy react-hooks/refs.
  const optsRef = useRef(opts)
  useEffect(() => {
    optsRef.current = opts
  })

  const buscar = useCallback((filtros: FiltrosBusqueda) => {
    const requestId = ++requestIdRef.current

    dispatch({ type: 'search' })

    const texto = filtros.texto?.trim() ?? ''

    if (texto !== '') {
      // Hybrid path: try the Edge Function first.
      const hardFiltros = toFiltrosEF(filtros)
      const efRequest = {
        texto,
        ...(Object.keys(hardFiltros).length > 0 ? { filtros: hardFiltros } : {}),
      }

      softwareService
        .buscarInteligente(efRequest)
        .then((resp) => {
          if (requestId !== requestIdRef.current) return
          dispatch({
            type: 'success',
            payload: {
              results: resp.resultados,
              usoFallback: false,
              intentUsado: resp.intent_usado,
            },
          })
          // Notify the page of extracted filters so it can mirror them into form
          // controls. This runs inside the async callback — safe for callers to setState.
          if (resp.filtros_aplicados) {
            optsRef.current.onFiltrosExtraidos?.(resp.filtros_aplicados)
          }
          void eventosService.registrarEvento({
            tipo: 'busqueda',
            metadata: buildMetadata(filtros),
          })
        })
        .catch(() => {
          // EF failed — fall back to ilike search transparently.
          if (requestId !== requestIdRef.current) return

          softwareService
            .buscar(filtros)
            .then((items) => {
              if (requestId !== requestIdRef.current) return
              dispatch({
                type: 'success',
                payload: {
                  results: items,
                  usoFallback: true,
                  intentUsado: false,
                },
              })
              void eventosService.registrarEvento({
                tipo: 'busqueda',
                metadata: buildMetadata(filtros),
              })
            })
            .catch((err: unknown) => {
              if (requestId !== requestIdRef.current) return
              dispatch({
                type: 'error',
                payload: err instanceof Error ? err : new Error(String(err)),
              })
            })
        })
    } else {
      // Filter-only or empty path: use ilike/eq directly (no EF call).
      softwareService
        .buscar(filtros)
        .then((items) => {
          if (requestId !== requestIdRef.current) return
          dispatch({
            type: 'success',
            payload: {
              results: items,
              usoFallback: false,
              intentUsado: false,
            },
          })
          void eventosService.registrarEvento({
            tipo: 'busqueda',
            metadata: buildMetadata(filtros),
          })
        })
        .catch((err: unknown) => {
          if (requestId !== requestIdRef.current) return
          dispatch({
            type: 'error',
            payload: err instanceof Error ? err : new Error(String(err)),
          })
        })
    }
  }, [])

  return {
    results: state.results,
    loading: state.loading,
    error: state.error,
    hasSearched: state.hasSearched,
    usoFallback: state.usoFallback,
    intentUsado: state.intentUsado,
    buscar,
  }
}
