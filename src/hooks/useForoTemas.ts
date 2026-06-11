import { useCallback, useEffect, useReducer } from 'react'
import type { TemaForo, NuevoTemaForo } from '../types/dtos'
import * as foroService from '../services/foroService'

// ---------------------------------------------------------------------------
// useForoTemas — fetches all temas_foro (descending, service default).
// Return shape per spec: { temas, loading, error, crear }
// Design D3: hook is effectively read-only; `crear` delegates to page-level
// service call then dispatches refetch so list refreshes atomically.
// Active-flag stale guard prevents state updates after unmount.
// ---------------------------------------------------------------------------

type State = {
  data: TemaForo[]
  loading: boolean
  error: Error | null
  version: number
}

type Action =
  | { type: 'refetch' }
  | { type: 'success'; payload: TemaForo[] }
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

export function useForoTemas(): {
  temas: TemaForo[]
  loading: boolean
  error: string | null
  crear: (input: NuevoTemaForo) => Promise<void>
} {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    let active = true

    foroService
      .listarTemasForo()
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

  const crear = useCallback(
    async (input: NuevoTemaForo): Promise<void> => {
      await foroService.crearTemaForo(input)
      refetch()
    },
    [refetch],
  )

  return {
    temas: state.data,
    loading: state.loading,
    error: state.error ? state.error.message : null,
    crear,
  }
}
