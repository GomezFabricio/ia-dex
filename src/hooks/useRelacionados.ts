import { useCallback, useEffect, useReducer } from 'react'
import type { Software } from '../types/dtos'
import * as softwareService from '../services/softwareService'

// ---------------------------------------------------------------------------
// useRelacionados — semantic neighbours of a software item via the
// software_relacionados RPC (cosine similarity with an adaptive cutoff). The RPC
// already excludes the row itself and rows without an embedding, so no client
// filtering is needed. Follows the canonical 4-action reducer template (D1).
//
// Empty data with loading=false and error=null is a valid loaded-empty state
// (the row has no embedding yet, or no neighbour fell within the margin) — detail
// pages treat it as the signal to fall back to useRecomendaciones (same-theme).
//
// Skip variant: softwareId === undefined → success([]), return early (no fetch),
// so a detail page can call the hook unconditionally before the id resolves.
//
// Effect deps: [softwareId, state.version]
// Return shape: { data, loading, error, refetch }
// ---------------------------------------------------------------------------

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

export function useRelacionados(softwareId: string | undefined): {
  data: Software[]
  loading: boolean
  error: Error | null
  refetch: () => void
} {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    // Skip variant: dependency not ready yet — render as loaded-empty
    if (softwareId === undefined) {
      dispatch({ type: 'success', payload: [] })
      return
    }

    let active = true

    dispatch({ type: 'pending' })

    softwareService
      .relacionados(softwareId, RESULT_LIMIT)
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
  }, [softwareId, state.version])

  const refetch = useCallback(() => dispatch({ type: 'refetch' }), [])

  return { data: state.data, loading: state.loading, error: state.error, refetch }
}
