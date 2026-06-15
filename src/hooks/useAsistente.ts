import { useCallback, useEffect, useRef, useState } from 'react'
import type { AsistenteMensaje } from '../types/dtos'
import * as asistenteService from '../services/asistenteService'

// ---------------------------------------------------------------------------
// useAsistente — chat state for the AsistenteWidget.
// Holds the message list (seeded with a greeting), a sending flag and an error.
// enviar() appends the user message, calls the EF with the last few turns as
// historial (+ optional page context), then appends the answer. On failure it
// appends a friendly assistant message and surfaces `error`.
// A ref mirrors the messages so enviar() can read history without side effects
// inside a state updater.
// ---------------------------------------------------------------------------

const GREETING: AsistenteMensaje = {
  role: 'assistant',
  text: '¡Hola! Soy el asistente de IA-dex. Preguntame sobre cualquier herramienta, tema o concepto de IA del catálogo.',
}

export function useAsistente(): {
  mensajes: AsistenteMensaje[]
  enviando: boolean
  error: string | null
  enviar: (pregunta: string, pagina?: string) => void
} {
  const [mensajes, setMensajes] = useState<AsistenteMensaje[]>([GREETING])
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Mirror of the message list so enviar() can read the current history
  // synchronously without a state-updater side effect. Synced in an effect.
  const mensajesRef = useRef(mensajes)
  useEffect(() => {
    mensajesRef.current = mensajes
  }, [mensajes])

  const enviar = useCallback(
    (pregunta: string, pagina?: string) => {
      const texto = pregunta.trim()
      if (texto === '' || enviando) return

      const historial = mensajesRef.current
        .filter((m) => m !== GREETING)
        .map((m) => ({ role: m.role, text: m.text }))

      setMensajes((prev) => [...prev, { role: 'user', text: texto }])
      setEnviando(true)
      setError(null)

      asistenteService
        .preguntar({ pregunta: texto, historial, pagina })
        .then((res) => {
          setMensajes((cur) => [...cur, { role: 'assistant', text: res.respuesta, fuentes: res.fuentes }])
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : String(err))
          setMensajes((cur) => [
            ...cur,
            { role: 'assistant', text: 'Perdoná, no pude responder ahora mismo. Probá de nuevo en un momento.' },
          ])
        })
        .finally(() => setEnviando(false))
    },
    [enviando],
  )

  return { mensajes, enviando, error, enviar }
}
