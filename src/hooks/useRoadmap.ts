import { useCallback, useEffect, useReducer } from 'react'
import type { EtapaRoadmap } from '../types/dtos'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'
import * as roadmapService from '../services/roadmapService'

// ---------------------------------------------------------------------------
// useRoadmap — composes the roadmap stages (temas + featured software) with the
// user's per-stage progress. State lives in a reducer (D1) so the effects can
// dispatch synchronously without tripping react-hooks/set-state-in-effect.
//
// Progress source depends on auth:
//   - Authenticated → progreso_roadmap table (RLS scopes to the user).
//   - Anonymous     → localStorage (array of tema_id).
//
// On the SIGNED_IN event (NOT TOKEN_REFRESHED), any anonymous localStorage
// progress is migrated into the table with ON CONFLICT DO NOTHING, then cleared.
//
// toggleProgreso updates optimistically and reverts on failure.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'roadmap_progreso'

function readLocalProgreso(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string')
      : []
  } catch {
    return []
  }
}

function writeLocalProgreso(temaIds: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(temaIds))
  } catch {
    // ignore quota / unavailable storage
  }
}

type State = {
  etapas: EtapaRoadmap[]
  progreso: Set<string>
  loading: boolean
  error: Error | null
}

type Action =
  | { type: 'etapas_success'; payload: EtapaRoadmap[] }
  | { type: 'etapas_error'; payload: Error }
  | { type: 'progreso_set'; payload: Set<string> }
  | { type: 'progreso_add'; temaId: string }
  | { type: 'progreso_remove'; temaId: string }

const initialState: State = {
  etapas: [],
  progreso: new Set(),
  loading: true,
  error: null,
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'etapas_success':
      return { ...state, etapas: action.payload, loading: false, error: null }
    case 'etapas_error':
      return { ...state, loading: false, error: action.payload }
    case 'progreso_set':
      return { ...state, progreso: action.payload }
    case 'progreso_add': {
      const next = new Set(state.progreso)
      next.add(action.temaId)
      return { ...state, progreso: next }
    }
    case 'progreso_remove': {
      const next = new Set(state.progreso)
      next.delete(action.temaId)
      return { ...state, progreso: next }
    }
  }
}

export function useRoadmap(): {
  etapas: EtapaRoadmap[]
  progreso: Set<string>
  loading: boolean
  error: Error | null
  toggleProgreso: (temaId: string) => void
  total: number
  completados: number
} {
  const { user } = useAuth()
  const [state, dispatch] = useReducer(reducer, initialState)

  // Load stages (temas + featured software) once.
  useEffect(() => {
    let active = true

    roadmapService
      .getTemasOrdenados()
      .then(async (temas) => {
        const destacados = await Promise.all(
          temas.map((t) => roadmapService.getTopSoftwarePorTema(t.id, 3)),
        )
        if (!active) return
        dispatch({
          type: 'etapas_success',
          payload: temas.map((tema, i) => ({ tema, destacados: destacados[i] })),
        })
      })
      .catch((err: unknown) => {
        if (active)
          dispatch({
            type: 'etapas_error',
            payload: err instanceof Error ? err : new Error(String(err)),
          })
      })

    return () => {
      active = false
    }
  }, [])

  // Load progress: DB when authenticated, localStorage when anonymous.
  useEffect(() => {
    let active = true

    if (user) {
      roadmapService
        .getProgreso(user.id)
        .then((ids) => {
          if (active) dispatch({ type: 'progreso_set', payload: new Set(ids) })
        })
        .catch(() => {
          if (active) dispatch({ type: 'progreso_set', payload: new Set() })
        })
    } else {
      dispatch({ type: 'progreso_set', payload: new Set(readLocalProgreso()) })
    }

    return () => {
      active = false
    }
  }, [user])

  // Migrate localStorage → DB on SIGNED_IN only (never on TOKEN_REFRESHED).
  // On first sign-in this and the [user] effect both dispatch progreso_set; the
  // migration's dispatch lands last (it awaits migrar + getProgreso) so the merged
  // state wins. Benign convergence — ON CONFLICT DO NOTHING prevents double writes.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== 'SIGNED_IN' || !session?.user) return
      const userId = session.user.id
      const local = readLocalProgreso()
      if (local.length === 0) return

      roadmapService
        .migrarProgreso(userId, local)
        .then(() => {
          writeLocalProgreso([])
          return roadmapService.getProgreso(userId)
        })
        .then((ids) => dispatch({ type: 'progreso_set', payload: new Set(ids) }))
        .catch(() => {
          // keep localStorage as fallback if migration fails
        })
    })

    return () => subscription.unsubscribe()
  }, [])

  const toggleProgreso = useCallback(
    (temaId: string) => {
      const yaCompletado = state.progreso.has(temaId)

      // optimistic update
      dispatch(
        yaCompletado
          ? { type: 'progreso_remove', temaId }
          : { type: 'progreso_add', temaId },
      )

      const revert = () =>
        dispatch(
          yaCompletado
            ? { type: 'progreso_add', temaId }
            : { type: 'progreso_remove', temaId },
        )

      if (user) {
        const op = yaCompletado
          ? roadmapService.deleteProgreso(user.id, temaId)
          : roadmapService.upsertProgreso(user.id, temaId)
        op.catch(revert)
      } else {
        const current = readLocalProgreso()
        const next = yaCompletado
          ? current.filter((id) => id !== temaId)
          : [...new Set([...current, temaId])]
        writeLocalProgreso(next)
      }
    },
    [state.progreso, user],
  )

  return {
    etapas: state.etapas,
    progreso: state.progreso,
    loading: state.loading,
    error: state.error,
    toggleProgreso,
    total: state.etapas.length,
    completados: state.progreso.size,
  }
}
