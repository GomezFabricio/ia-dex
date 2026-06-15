import { useCallback, useEffect, useReducer } from 'react'
import type { PublicacionConAutor } from '../types/dtos'
import * as publicacionesService from '../services/publicacionesService'

// ---------------------------------------------------------------------------
// usePublicacionesPorTema — published publicaciones linked to a temaId.
// Skip variant: when temaId is undefined, dispatches success([]) and skips fetch
// (signals "dependency not ready" — renders as loaded-empty, not loading forever).
// `pending` action at effect start resets stale data on temaId change.
// Return shape: { data, loading, error, refetch }
// ---------------------------------------------------------------------------

type State = {
  data: PublicacionConAutor[]
  loading: boolean
  error: Error | null
  version: number
}

type Action =
  | { type: 'pending' }
  | { type: 'refetch' }
  | { type: 'success'; payload: PublicacionConAutor[] }
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

export function usePublicacionesPorTema(temaId: string | undefined): {
  data: PublicacionConAutor[]
  loading: boolean
  error: Error | null
  refetch: () => void
} {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    let active = true

    // Skip variant: temaId not ready yet — resolve as empty without fetching
    if (temaId === undefined) {
      dispatch({ type: 'success', payload: [] })
      return
    }

    dispatch({ type: 'pending' })

    publicacionesService
      .listarPorTema(temaId)
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
  }, [temaId, state.version])

  const refetch = useCallback(() => dispatch({ type: 'refetch' }), [])

  return { data: state.data, loading: state.loading, error: state.error, refetch }
}
