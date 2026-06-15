import { useCallback, useEffect, useReducer } from 'react'
import type { PublicacionConAutor } from '../types/dtos'
import * as publicacionesService from '../services/publicacionesService'

// ---------------------------------------------------------------------------
// usePublicacionesAdmin — admin list container. Fetches EVERY publicacion the
// caller may read (drafts included for an admin via RLS) with an active-flag
// stale guard. Mirrors usePublicaciones (no 'pending' action); the only
// difference is it calls listarTodasParaAdmin() instead of the published feed.
// Return shape per design D4: { data, loading, error, refetch }.
// ---------------------------------------------------------------------------

type State = {
  data: PublicacionConAutor[]
  loading: boolean
  error: Error | null
  version: number
}

type Action =
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
    case 'refetch':
      return { ...state, loading: true, error: null, version: state.version + 1 }
    case 'success':
      return { ...state, loading: false, data: action.payload, error: null }
    case 'error':
      return { ...state, loading: false, data: [], error: action.payload }
  }
}

export function usePublicacionesAdmin(): {
  data: PublicacionConAutor[]
  loading: boolean
  error: Error | null
  refetch: () => void
} {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    let active = true

    publicacionesService
      .listarTodasParaAdmin()
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
  }, [state.version])

  const refetch = useCallback(() => dispatch({ type: 'refetch' }), [])

  return { data: state.data, loading: state.loading, error: state.error, refetch }
}
