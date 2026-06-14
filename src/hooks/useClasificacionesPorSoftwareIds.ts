import { useCallback, useEffect, useReducer } from 'react'
import type { ClasificacionConCriterio } from '../types/dtos'
import * as clasificacionesService from '../services/clasificacionesService'

// ---------------------------------------------------------------------------
// useClasificacionesPorSoftwareIds — batch junction fetch.
// Given a list of software IDs, returns Map<softwareId, ClasificacionConCriterio[]>
// in one single query. Skip variant: empty array → success(new Map()).
// ---------------------------------------------------------------------------

type State = {
  data: Map<string, ClasificacionConCriterio[]>
  loading: boolean
  error: Error | null
  version: number
}

type Action =
  | { type: 'pending' }
  | { type: 'refetch' }
  | { type: 'success'; payload: Map<string, ClasificacionConCriterio[]> }
  | { type: 'error'; payload: Error }

const initialState: State = {
  data: new Map(),
  loading: true,
  error: null,
  version: 0,
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'pending':
      return { ...state, data: new Map(), loading: true, error: null }
    case 'refetch':
      return { ...state, loading: true, error: null, version: state.version + 1 }
    case 'success':
      return { ...state, loading: false, data: action.payload, error: null }
    case 'error':
      return { ...state, loading: false, data: new Map(), error: action.payload }
  }
}

export function useClasificacionesPorSoftwareIds(softwareIds: string[]): {
  data: Map<string, ClasificacionConCriterio[]>
  loading: boolean
  error: Error | null
  refetch: () => void
} {
  const [state, dispatch] = useReducer(reducer, initialState)

  // Stable key to avoid re-renders when the array reference changes but content is the same.
  const idsKey = softwareIds.slice().sort().join(',')

  useEffect(() => {
    let active = true

    if (softwareIds.length === 0) {
      dispatch({ type: 'success', payload: new Map() })
      return
    }

    dispatch({ type: 'pending' })

    clasificacionesService
      .listarClasificacionesPorSoftwareIds(softwareIds)
      .then((map) => {
        if (active) dispatch({ type: 'success', payload: map })
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
    // idsKey is derived from softwareIds — it's the stable dep
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, state.version])

  const refetch = useCallback(() => dispatch({ type: 'refetch' }), [])

  return { data: state.data, loading: state.loading, error: state.error, refetch }
}
