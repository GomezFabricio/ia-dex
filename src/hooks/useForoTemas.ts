import { useCallback, useEffect, useReducer } from 'react'
import type {
  TemaForoConAutor,
  NuevoTemaForo,
  ForoScope,
  ForoScopeTipo,
  ForoFiltro,
} from '../types/dtos'
import * as foroService from '../services/foroService'

// ---------------------------------------------------------------------------
// useForoTemas — fetches temas_foro (descending, service default).
// Optional scope filter (filtroTipo + filtroId, passed as primitives so the
// effect deps stay stable): when set, only debates scoped to that entity are
// returned and `scope` resolves to the target entity (for the page header).
// Return shape: { temas, loading, error, crear, scope }.
// Design D3: hook is effectively read-only; `crear` delegates to the service
// then dispatches refetch so the list refreshes atomically.
// Active-flag stale guard prevents state updates after unmount.
// ---------------------------------------------------------------------------

type State = {
  data: TemaForoConAutor[]
  scope: ForoScope | null
  loading: boolean
  error: Error | null
  version: number
}

type Action =
  | { type: 'loading' }
  | { type: 'refetch' }
  | { type: 'success'; payload: { temas: TemaForoConAutor[]; scope: ForoScope | null } }
  | { type: 'error'; payload: Error }

const initialState: State = {
  data: [],
  scope: null,
  loading: true,
  error: null,
  version: 0,
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'loading':
      return { ...state, loading: true, error: null }
    case 'refetch':
      return { ...state, loading: true, error: null, version: state.version + 1 }
    case 'success':
      return {
        ...state,
        loading: false,
        data: action.payload.temas,
        scope: action.payload.scope,
        error: null,
      }
    case 'error':
      return { ...state, loading: false, data: [], scope: null, error: action.payload }
  }
}

export function useForoTemas(
  filtroTipo?: ForoScopeTipo | null,
  filtroId?: string | null,
): {
  temas: TemaForoConAutor[]
  loading: boolean
  error: string | null
  crear: (input: NuevoTemaForo) => Promise<void>
  scope: ForoScope | null
} {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    let active = true

    const filtro: ForoFiltro | null =
      filtroTipo != null && filtroId != null && filtroId !== ''
        ? { tipo: filtroTipo, id: filtroId }
        : null

    dispatch({ type: 'loading' })

    Promise.all([
      foroService.listarTemasForo(filtro),
      filtro ? foroService.obtenerScope(filtro) : Promise.resolve(null),
    ])
      .then(([temas, scope]) => {
        if (active) dispatch({ type: 'success', payload: { temas, scope } })
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
  }, [state.version, filtroTipo, filtroId])

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
    scope: state.scope,
  }
}
