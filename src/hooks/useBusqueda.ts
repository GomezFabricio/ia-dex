import { useCallback, useReducer, useRef } from 'react'
import type { Software, FiltrosBusqueda } from '../types/dtos'
import * as softwareService from '../services/softwareService'
import * as eventosService from '../services/eventosService'

// ---------------------------------------------------------------------------
// useBusqueda — imperative search hook with stale-response guard (D5).
// Does NOT trigger on mount or on filter changes — caller must invoke buscar().
// useReducer (not useState) keeps loading/error/results atomic (design pattern).
// ---------------------------------------------------------------------------

type State = {
  results: Software[]
  loading: boolean
  error: Error | null
  hasSearched: boolean
}

type Action =
  | { type: 'search' }
  | { type: 'success'; payload: Software[] }
  | { type: 'error'; payload: Error }

const initialState: State = {
  results: [],
  loading: false,
  error: null,
  hasSearched: false,
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'search':
      return { ...state, loading: true, error: null, hasSearched: true }
    case 'success':
      return { ...state, loading: false, results: action.payload }
    case 'error':
      return { ...state, loading: false, results: [], error: action.payload }
  }
}

// Builds metadata with only non-empty / non-undefined fields (Spec 1 scenario 4).
function buildMetadata(filtros: FiltrosBusqueda): Record<string, unknown> {
  const metadata: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(filtros)) {
    if (value !== undefined && value !== '') {
      metadata[key] = value
    }
  }
  return metadata
}

export type UseBusquedaReturn = {
  results: Software[]
  loading: boolean
  error: Error | null
  hasSearched: boolean
  buscar: (filtros: FiltrosBusqueda) => void
}

export function useBusqueda(): UseBusquedaReturn {
  const [state, dispatch] = useReducer(reducer, initialState)
  // D5: stale-response guard — only the latest request dispatches results.
  const requestIdRef = useRef(0)

  const buscar = useCallback((filtros: FiltrosBusqueda) => {
    const requestId = ++requestIdRef.current

    dispatch({ type: 'search' })

    // Fire-and-forget analytics; failure must not affect search outcome (Spec 1).
    void eventosService.registrarEvento({
      tipo: 'busqueda',
      metadata: buildMetadata(filtros),
    })

    softwareService
      .buscar(filtros)
      .then((items) => {
        if (requestId === requestIdRef.current) {
          dispatch({ type: 'success', payload: items })
        }
      })
      .catch((err: unknown) => {
        if (requestId === requestIdRef.current) {
          dispatch({
            type: 'error',
            payload: err instanceof Error ? err : new Error(String(err)),
          })
        }
      })
  }, [])

  return {
    results: state.results,
    loading: state.loading,
    error: state.error,
    hasSearched: state.hasSearched,
    buscar,
  }
}
