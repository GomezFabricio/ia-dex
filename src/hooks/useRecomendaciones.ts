import { useCallback, useEffect, useReducer } from 'react'
import type { Software } from '../types/dtos'
import * as estadisticasService from '../services/estadisticasService'

// ---------------------------------------------------------------------------
// useRecomendaciones — fetches recommended software for a given tema, excluding
// the current item. Follows the canonical 4-action reducer template (D1).
//
// Skip variant: temaId === undefined → dispatch success([]), return early (no fetch).
// This lets detail pages call the hook unconditionally even before tema_id resolves.
//
// Fetch strategy: request 6 items (limite + 1), filter out excludeId client-side,
// then slice to at most 5. This guarantees the current item never appears in results.
//
// Effect deps: [temaId, excludeId, state.version]
// Return shape: { data, loading, error, refetch }
// ---------------------------------------------------------------------------

const FETCH_LIMIT = 6
const RESULT_LIMIT = 5

type State = {
  data: Software[]
  loading: boolean
  error: Error | null
  version: number
}

type Action =
  | { type: 'pending' }
  | { type: 'refetch' }
  | { type: 'success'; payload: Software[] }
  | { type: 'error'; payload: Error }

const initialState: State = {
  data: [],
  loading: true,
  error: null,
  version: 0,
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'pending':
      return { ...state, data: [], loading: true, error: null }
    case 'refetch':
      return { ...state, loading: true, error: null, version: state.version + 1 }
    case 'success':
      return { ...state, loading: false, data: action.payload, error: null }
    case 'error':
      return { ...state, loading: false, data: [], error: action.payload }
  }
}

export function useRecomendaciones(
  temaId: string | undefined,
  excludeId: string,
): {
  data: Software[]
  loading: boolean
  error: Error | null
  refetch: () => void
} {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    // Skip variant: dependency not ready yet — render as loaded-empty
    if (temaId === undefined) {
      dispatch({ type: 'success', payload: [] })
      return
    }

    let active = true

    dispatch({ type: 'pending' })

    estadisticasService
      .recomendaciones(temaId, FETCH_LIMIT)
      .then((items) => {
        if (!active) return
        const filtered = items
          .filter((s) => s.id !== excludeId)
          .slice(0, RESULT_LIMIT)
        dispatch({ type: 'success', payload: filtered })
      })
      .catch((err: unknown) => {
        if (active)
          dispatch({
            type: 'error',
            payload: err instanceof Error ? err : new Error(String(err)),
          })
      })

    return () => {
      active = false
    }
  }, [temaId, excludeId, state.version])

  const refetch = useCallback(() => dispatch({ type: 'refetch' }), [])

  return { data: state.data, loading: state.loading, error: state.error, refetch }
}
