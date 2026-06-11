import { useCallback, useEffect, useReducer } from 'react'
import type { TemaForo, MensajeForo } from '../types/dtos'
import * as foroService from '../services/foroService'

// ---------------------------------------------------------------------------
// useForoTema — fetches a single TemaForo + its MensajeForo list.
// Design D4: Promise.all([obtenerTemaForo, listarMensajes]) → single loading state.
// Not-found: obtenerTemaForo returns null → tema null, mensajes [], no error.
// Design D3: writes are page-level imperative calls; hook exposes only refetch.
// `pending` action dispatched at effect start clears stale data on id change.
// Active-flag stale guard prevents state updates after unmount.
// ---------------------------------------------------------------------------

type Payload = {
  tema: TemaForo | null
  mensajes: MensajeForo[]
}

type State = {
  tema: TemaForo | null
  mensajes: MensajeForo[]
  loading: boolean
  error: Error | null
  version: number
}

type Action =
  | { type: 'pending' }
  | { type: 'refetch' }
  | { type: 'success'; payload: Payload }
  | { type: 'error'; payload: Error }

const initialState: State = {
  tema: null,
  mensajes: [],
  loading: true,
  error: null,
  version: 0,
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'pending':
      return { ...state, tema: null, mensajes: [], loading: true, error: null }
    case 'refetch':
      return { ...state, loading: true, error: null, version: state.version + 1 }
    case 'success':
      return {
        ...state,
        loading: false,
        tema: action.payload.tema,
        mensajes: action.payload.mensajes,
        error: null,
      }
    case 'error':
      return { ...state, loading: false, tema: null, mensajes: [], error: action.payload }
  }
}

export function useForoTema(id: string): {
  tema: TemaForo | null
  mensajes: MensajeForo[]
  loading: boolean
  error: string | null
  refetch: () => void
} {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    let active = true

    dispatch({ type: 'pending' })

    Promise.all([
      foroService.obtenerTemaForo(id),
      foroService.listarMensajes(id),
    ])
      .then(([tema, mensajes]) => {
        if (active) {
          // Not-found: tema null → mensajes irrelevant but we keep the fetched [] or [].
          // If tema is null, discard mensajes (nothing to display).
          dispatch({
            type: 'success',
            payload: { tema, mensajes: tema !== null ? mensajes : [] },
          })
        }
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
  }, [id, state.version])

  const refetch = useCallback(() => dispatch({ type: 'refetch' }), [])

  return {
    tema: state.tema,
    mensajes: state.mensajes,
    loading: state.loading,
    error: state.error ? state.error.message : null,
    refetch,
  }
}
