import { useCallback, useEffect, useReducer } from 'react'
import type { ContenidoTipo } from '../types/dtos'
import * as valoracionesService from '../services/valoracionesService'
import { useAuth } from './useAuth'

// ---------------------------------------------------------------------------
// useValoracion — fetches promedio + miVoto for a content item and exposes guardar
// Design decisions:
//   D1: useAuth called internally; userId joins effect deps so own-vote refreshes on signOut
//   D2: key={contenidoId} on StarRating mounts handles param reset; no `pending` action needed
//   No pending action: avoids blanking stars on every post-vote refetch
// Reducer has 5 actions: refetch / success / error / saving / save-error
// ---------------------------------------------------------------------------

type ValoracionData = {
  promedio: number
  cantidad: number
  miVoto: number | null
}

type State = {
  data: ValoracionData | null
  loading: boolean
  saving: boolean
  error: string | null
  version: number
}

type Action =
  | { type: 'refetch' }
  | { type: 'success'; payload: ValoracionData }
  | { type: 'error'; payload: string }
  | { type: 'saving' }
  | { type: 'save-error'; payload: string }

const initialState: State = {
  data: null,
  loading: true,
  saving: false,
  error: null,
  version: 0,
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'refetch':
      return { ...state, loading: true, error: null, version: state.version + 1 }
    case 'success':
      return { ...state, loading: false, saving: false, data: action.payload, error: null }
    case 'error':
      return { ...state, loading: false, data: null, error: action.payload }
    case 'saving':
      return { ...state, saving: true, error: null }
    case 'save-error':
      return { ...state, saving: false, error: action.payload }
  }
}

export function useValoracion(
  tipo: ContenidoTipo,
  contenidoId: string,
): {
  promedio: number
  cantidad: number
  miVoto: number | null
  loading: boolean
  saving: boolean
  error: string | null
  guardar: (puntaje: number) => void
  refetch: () => void
} {
  const { user } = useAuth()
  const userId = user?.id ?? null

  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    let active = true

    Promise.all([
      valoracionesService.promedio(tipo, contenidoId),
      valoracionesService.miValoracion(tipo, contenidoId),
    ])
      .then(([promedioResult, miValoResult]) => {
        if (!active) return
        dispatch({
          type: 'success',
          payload: {
            promedio: promedioResult.promedio,
            cantidad: promedioResult.cantidad,
            miVoto: miValoResult?.puntaje ?? null,
          },
        })
      })
      .catch(() => {
        if (!active) return
        dispatch({
          type: 'error',
          payload: 'Error al cargar la valoración',
        })
      })

    return () => {
      active = false
    }
  }, [tipo, contenidoId, userId, state.version])

  const guardar = useCallback(
    (puntaje: number) => {
      if (state.saving) return

      dispatch({ type: 'saving' })

      valoracionesService
        .guardarValoracion({ contenido_tipo: tipo, contenido_id: contenidoId, puntaje })
        .then(() => {
          dispatch({ type: 'refetch' })
        })
        .catch(() => {
          dispatch({
            type: 'save-error',
            payload: 'Error al guardar la valoración',
          })
        })
    },
    [tipo, contenidoId, state.saving],
  )

  const refetch = useCallback(() => dispatch({ type: 'refetch' }), [])

  return {
    promedio: state.data?.promedio ?? 0,
    cantidad: state.data?.cantidad ?? 0,
    miVoto: state.data?.miVoto ?? null,
    loading: state.loading,
    saving: state.saving,
    error: state.error,
    guardar,
    refetch,
  }
}
