import { useCallback, useEffect, useReducer } from 'react'
import type { PublicacionRating } from '../types/dtos'
import * as publicacionesService from '../services/publicacionesService'

// ---------------------------------------------------------------------------
// usePublicacionesMasValoradas — fetches the highest-rated published
// publicaciones from v_publicaciones_rating (publicaciones voting strip).
// Follows the canonical 4-action reducer template (D1): pending/refetch/success/error.
// Accepts `limite` (defaults to 5). Return shape: { data, loading, error, refetch }
// Effect deps: [limite, state.version]. No skip, no short-circuit.
// ---------------------------------------------------------------------------

type State = {
  data: PublicacionRating[]
  loading: boolean
  error: Error | null
  version: number
}

type Action =
  | { type: 'pending' }
  | { type: 'refetch' }
  | { type: 'success'; payload: PublicacionRating[] }
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

export function usePublicacionesMasValoradas(limite = 5): {
  data: PublicacionRating[]
  loading: boolean
  error: Error | null
  refetch: () => void
} {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    let active = true

    dispatch({ type: 'pending' })

    publicacionesService
      .listarMasValoradas(limite)
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
