import { useCallback, useEffect, useReducer } from 'react'
import type { Software } from '../types/dtos'
import * as softwareService from '../services/softwareService'

// ---------------------------------------------------------------------------
// useSoftware — fetches a single Software by id with active-flag stale guard
// Follows the canonical 4-action reducer template (D1 in design).
// `pending` action dispatched at effect start resets stale data on id change.
// Return shape: { data, loading, error, refetch }
// ---------------------------------------------------------------------------

type State = {
  data: Software | null
  loading: boolean
  error: Error | null
  version: number
}

type Action =
  | { type: 'pending' }
  | { type: 'refetch' }
  | { type: 'success'; payload: Software | null }
  | { type: 'error'; payload: Error }

const initialState: State = {
  data: null,
  loading: true,
  error: null,
  version: 0,
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'pending':
      return { ...state, data: null, loading: true, error: null }
    case 'refetch':
      return { ...state, loading: true, error: null, version: state.version + 1 }
    case 'success':
      return { ...state, loading: false, data: action.payload, error: null }
    case 'error':
      return { ...state, loading: false, data: null, error: action.payload }
  }
}

export function useSoftware(id: string): {
  data: Software | null
  loading: boolean
  error: Error | null
  refetch: () => void
} {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    let active = true

    dispatch({ type: 'pending' })

    softwareService
      .obtenerSoftware(id)
      .then((item) => {
        if (active) dispatch({ type: 'success', payload: item })
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
  }, [id, state.version])

  const refetch = useCallback(() => dispatch({ type: 'refetch' }), [])

  return { data: state.data, loading: state.loading, error: state.error, refetch }
}
