import { useEffect, useRef, useState } from 'react'
import Modal from '../ui/Modal'

// ---------------------------------------------------------------------------
// VoiceSearchOverlay — centered listening dialog for voice search.
//
// While open it captures the mic via getUserMedia and renders a live frequency
// bar visualization (AnalyserNode + requestAnimationFrame) below a large mic
// icon. SpeechRecognition (useVoz) keeps its own mic session — both can hold
// the microphone simultaneously in Chrome/Edge.
//
// Every close path (cancel button, Esc, backdrop click, recognition end)
// releases all audio resources: tracks stopped, AudioContext closed, rAF loop
// cancelled. If getUserMedia fails the overlay degrades to a static pulse —
// recognition itself may still be running.
// ---------------------------------------------------------------------------

type Props = {
  open: boolean
  onCancel: () => void
}

const BAR_COUNT = 24
const CANVAS_WIDTH = 280
const CANVAS_HEIGHT = 72

export default function VoiceSearchOverlay({ open, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [vizFailed, setVizFailed] = useState(false)

  useEffect(() => {
    if (!open) return

    let cancelled = false
    let stream: MediaStream | null = null
    let audioCtx: AudioContext | null = null
    let rafId = 0

    const startVisualization = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch {
        if (!cancelled) setVizFailed(true)
        return
      }
      // Overlay closed while the permission prompt was up — release immediately.
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      // Mic acquired — clear a possible failure flag from a previous session.
      setVizFailed(false)

      audioCtx = new AudioContext()
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 64
      analyser.smoothingTimeConstant = 0.7
      source.connect(analyser)

      const canvas = canvasRef.current
      const ctx2d = canvas?.getContext('2d')
      if (!canvas || !ctx2d) return

      // The canvas carries the text-accent class so the bars follow the theme.
      const accent = getComputedStyle(canvas).color
      const data = new Uint8Array(analyser.frequencyBinCount)
      const barWidth = CANVAS_WIDTH / BAR_COUNT

      const draw = () => {
        analyser.getByteFrequencyData(data)
        ctx2d.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
        ctx2d.fillStyle = accent
        for (let i = 0; i < BAR_COUNT; i++) {
          const level = (data[i] ?? 0) / 255
          const barHeight = Math.max(4, level * CANVAS_HEIGHT)
          const x = i * barWidth + barWidth * 0.2
          const y = (CANVAS_HEIGHT - barHeight) / 2
          ctx2d.beginPath()
          ctx2d.roundRect(x, y, barWidth * 0.6, barHeight, barWidth * 0.3)
          ctx2d.fill()
        }
        rafId = requestAnimationFrame(draw)
      }
      draw()
    }

    void startVisualization()

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
      stream?.getTracks().forEach((track) => track.stop())
      void audioCtx?.close()
    }
  }, [open])

  return (
    <Modal open={open} onClose={onCancel} labelledBy="voice-overlay-title">
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        {/* Large mic icon in an accent halo */}
        <span className="flex h-24 w-24 items-center justify-center rounded-full bg-accent/15 text-accent">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="44"
            height="44"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
        </span>

        <p id="voice-overlay-title" className="text-lg font-semibold text-text">
          Escuchando…
        </p>

        {/* Live waveform, or a static pulse if mic visualization is unavailable */}
        {vizFailed ? (
          <div
            className="flex h-[72px] items-center justify-center gap-1.5"
            aria-hidden="true"
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <span
                key={i}
                className="h-4 w-1.5 animate-pulse rounded-full bg-accent"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="text-accent"
            aria-hidden="true"
          />
        )}

        <p className="text-sm text-muted">
          Hablá ahora; la búsqueda se hace sola al terminar.
        </p>

        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-border px-4 py-2 text-sm text-muted transition-colors hover:text-text"
        >
          Cancelar
        </button>
      </div>
    </Modal>
  )
}
