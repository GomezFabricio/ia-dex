import { useCallback, useEffect, useReducer } from 'react'
import type { SoftwareRating } from '../types/dtos'
import * as estadisticasService from '../services/estadisticasService'

// ---------------------------------------------------------------------------
// useMejorValorados — fetches highest-rated software with active-flag stale guard.
// Follows the canonical 4-action reducer template (D1): pending/refetch/success/error.
// Accept `limite: number` parameter.
// Return shape: { data, loading, error, refetch }
// Effect deps: [limite, state.version]
// No skip, no short-circuit.
// ---------------------------------------------------------------------------

type State = {
  data: SoftwareRating[]
  loading: boolean
  error: Error | null
  version: number
}

type Action =
  | { type: 'pending' }
  | { type: 'refetch' }
  | { type: 'success'; payload: SoftwareRating[] }
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

export function useMejorValorados(limite: number): {
  data: SoftwareRating[]
  loading: boolean
  error: Error | null
  refetch: () => void
} {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    let active = true

    dispatch({ type: 'pending' })

    estadisticasService
      .mejorValorados(limite)
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
