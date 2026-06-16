import { useCallback, useEffect, useReducer } from 'react'
import type { ClasificacionConCriterio } from '../types/dtos'
import * as clasificacionesService from '../services/clasificacionesService'

// ---------------------------------------------------------------------------
// useClasificacionesDeSoftware — clasificaciones_si linked to a software via M2M.
// Skip variant: softwareId undefined → success([]) (dependency not ready).
// Canonical 4-action reducer. Return shape: { data, loading, error, refetch }
// ---------------------------------------------------------------------------

type State = {
  data: ClasificacionConCriterio[]
  loading: boolean
  error: Error | null
  version: number
}

type Action =
  | { type: 'pending' }
  | { type: 'refetch' }
  | { type: 'success'; payload: ClasificacionConCriterio[] }
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

export function useClasificacionesDeSoftware(softwareId?: string): {
  data: ClasificacionConCriterio[]
  loading: boolean
  error: Error | null
  refetch: () => void
} {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    let active = true

    if (softwareId === undefined) {
      dispatch({ type: 'success', payload: [] })
      return
    }

    dispatch({ type: 'pending' })

    clasificacionesService
      .listarClasificacionesDeSoftware(softwareId)
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
