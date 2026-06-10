import { useEffect, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// SpeechRecognition inline type stubs
// lib: ["ES2023","DOM"] does not include these types; no npm packages added (D1).
// Every stub is transitively referenced so noUnusedLocals passes (D2 reference chain).
// ---------------------------------------------------------------------------

interface SpeechRecognitionAlternative {
  readonly transcript: string
  readonly confidence: number
}

interface SpeechRecognitionResult {
  readonly length: number
  readonly isFinal: boolean
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionResultList {
  readonly length: number
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList
}

type SpeechRecognitionErrorCode =
  | 'aborted'
  | 'audio-capture'
  | 'bad-grammar'
  | 'language-not-supported'
  | 'network'
  | 'no-speech'
  | 'not-allowed'
  | 'service-not-allowed'

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: SpeechRecognitionErrorCode
}

interface SpeechRecognitionInstance {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((ev: SpeechRecognitionEvent) => void) | null
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

// Feature detection — the ONLY cast in this change (D2).
type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  const w = window as SpeechWindow
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

// ---------------------------------------------------------------------------
// Error message map (covers every SpeechRecognitionErrorCode)
// ---------------------------------------------------------------------------

const VOICE_ERROR_MESSAGES: Partial<Record<SpeechRecognitionErrorCode, string>> = {
  'not-allowed': 'Permití el acceso al micrófono para usar la búsqueda por voz.',
  'service-not-allowed': 'Permití el acceso al micrófono para usar la búsqueda por voz.',
  'no-speech': 'No se detectó voz. Intentá de nuevo.',
}

const VOICE_ERROR_FALLBACK = 'No se pudo usar el micrófono. Escribí tu búsqueda.'

// ---------------------------------------------------------------------------
// useVoz — wraps SpeechRecognition with es-AR lang, continuous=false.
// D3: onTranscript stored in a ref updated every render so recognition
// instance always calls the freshest handler even after form state changes.
// Unmount cleanup uses abort() (not stop()) to avoid StrictMode onend re-trigger (D8).
// ---------------------------------------------------------------------------

export type UseVozReturn = {
  isSupported: boolean
  isListening: boolean
  error: string | null
  start: () => void
  stop: () => void
  clearError: () => void
}

export function useVoz(onTranscript: (transcript: string) => void): UseVozReturn {
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  // D3: latest-ref — re-assigned on every render so the recognition instance
  // always dispatches to the current form state without stale closure.
  const onTranscriptRef = useRef(onTranscript)

  // Ref update effect MUST come before any handler wiring (T5 risk note).
  useEffect(() => {
    onTranscriptRef.current = onTranscript
  })

  const isSupported = getSpeechRecognitionCtor() !== null

  const start = () => {
    const Ctor = getSpeechRecognitionCtor()
    if (Ctor === null || isListening) return

    const recognition = new Ctor()
    recognition.lang = 'es-AR'
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onresult = (ev: SpeechRecognitionEvent) => {
      const result = ev.results[0]
      if (result !== undefined && result.isFinal) {
        const alternative = result[0]
        if (alternative !== undefined && alternative.transcript.trim() !== '') {
          onTranscriptRef.current(alternative.transcript.trim())
        }
      }
    }

    recognition.onerror = (ev: SpeechRecognitionErrorEvent) => {
      setError(VOICE_ERROR_MESSAGES[ev.error] ?? VOICE_ERROR_FALLBACK)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    setError(null)
    setIsListening(true)
    recognition.start()
  }

  const stop = () => {
    recognitionRef.current?.stop()
  }

  const clearError = () => {
    setError(null)
  }

  // Unmount cleanup: null all handlers THEN abort() — StrictMode safe.
  useEffect(() => {
    return () => {
      const r = recognitionRef.current
      if (r !== null) {
        r.onresult = null
        r.onerror = null
        r.onend = null
        r.abort()
      }
    }
  }, [])

  return { isSupported, isListening, error, start, stop, clearError }
}
