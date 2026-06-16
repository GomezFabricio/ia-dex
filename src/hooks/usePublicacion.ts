import { useCallback, useEffect, useReducer } from 'react'
import type { PublicacionConAutor } from '../types/dtos'
import * as publicacionesService from '../services/publicacionesService'

// ---------------------------------------------------------------------------
// usePublicacion — fetches a single PublicacionConAutor by slug with active-flag
// stale guard. Extends the canonical useTemas template with two additions
// (mirrors useTema):
//   1. `slug` joins effect deps so param changes re-run the effect.
//   2. `pending` action dispatched at effect start resets stale data on slug change.
// Return shape: { data, loading, error, refetch }
// ---------------------------------------------------------------------------

type State = {
  data: PublicacionConAutor | null
  loading: boolean
  error: Error | null
  version: number
}

type Action =
  | { type: 'pending' }
  | { type: 'refetch' }
  | { type: 'success'; payload: PublicacionConAutor | null }
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

export function usePublicacion(slug: string): {
  data: PublicacionConAutor | null
  loading: boolean
  error: Error | null
  refetch: () => void
} {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    let active = true

    dispatch({ type: 'pending' })

    publicacionesService
      .obtenerPublicacion(slug)
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
  }, [slug, state.version])

  const refetch = useCallback(() => dispatch({ type: 'refetch' }), [])

  return { data: state.data, loading: state.loading, error: state.error, refetch }
}
