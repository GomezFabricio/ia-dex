import { useCallback, useEffect, useReducer } from 'react'
import type { Software } from '../types/dtos'
import * as estadisticasService from '../services/estadisticasService'

// ---------------------------------------------------------------------------
// useRecomendacionesGlobales — fetches global software recommendations (no tema filter).
// Follows the canonical 4-action reducer template (D1): pending/refetch/success/error.
// Calls recomendaciones(undefined, limite) — no excludeId, no skip variant.
// Accept `limite: number` parameter.
// Return shape: { data, loading, error, refetch }
// Effect deps: [limite, state.version]
// Cold-start: if no views exist, service returns alphabetical list (never empty).
// ---------------------------------------------------------------------------

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

export function useRecomendacionesGlobales(limite: number): {
  data: Software[]
  loading: boolean
  error: Error | null
  refetch: () => void
} {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    let active = true

    dispatch({ type: 'pending' })

    estadisticasService
      .recomendaciones(undefined, limite)
      .then((items) => {
        if (active) dispatch({ type: 'success', payload: items })
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
  }, [limite, state.version])

  const refetch = useCallback(() => dispatch({ type: 'refetch' }), [])

  return { data: state.data, loading: state.loading, error: state.error, refetch }
}
