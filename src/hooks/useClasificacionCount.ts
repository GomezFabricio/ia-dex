import { useCallback, useEffect, useReducer } from 'react'
import { supabase } from '../lib/supabase'

// ---------------------------------------------------------------------------
// useClasificacionCount — builds a Map<clasificacion_si_id, count> from the
// software_clasificaciones junction table. One single query; no per-tile fetch.
// Return shape: { data: Map<string,number>, loading, error, refetch }
// ---------------------------------------------------------------------------

type State = {
  data: Map<string, number>
  loading: boolean
  error: Error | null
  version: number
}

type Action =
  | { type: 'refetch' }
  | { type: 'success'; payload: Map<string, number> }
  | { type: 'error'; payload: Error }

const initialState: State = {
  data: new Map(),
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
      return { ...state, loading: false, data: new Map(), error: action.payload }
  }
}

export function useClasificacionCount(): {
  data: Map<string, number>
  loading: boolean
  error: Error | null
  refetch: () => void
} {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    let active = true

    const run = async () => {
      const { data, error } = await supabase
        .from('software_clasificaciones')
        .select('clasificacion_si_id')

      if (!active) return
      if (error) {
        dispatch({ type: 'error', payload: new Error(error.message) })
        return
      }
      const counts = new Map<string, number>()
      for (const row of data ?? []) {
        const id = row.clasificacion_si_id
        counts.set(id, (counts.get(id) ?? 0) + 1)
      }
      dispatch({ type: 'success', payload: counts })
    }

    run().catch((err: unknown) => {
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
