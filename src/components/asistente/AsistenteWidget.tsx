import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAsistente } from '../../hooks/useAsistente'
import { useVoz } from '../../hooks/useVoz'

// ---------------------------------------------------------------------------
// AsistenteWidget — the "nube del asistente": a floating neural FAB that opens a
// Gemini-grounded chat panel (header / messages with sources + TTS / "Resumime
// esta página" + input + voice + send). Mounted once in AppLayout, fixed to the
// bottom-right above the mobile thumb cluster. Recreates the assistant from the
// design handoff. Voice dictation fills the input; "Escuchar" reads an answer via
// the Web Speech API. Closed state shows a breathing FAB with an attention dot.
// ---------------------------------------------------------------------------

const Sparkle = ({ size = 30 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <defs>
      <linearGradient id="asst-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#8B5CFF" />
        <stop offset="0.5" stopColor="#FF4FD8" />
        <stop offset="1" stopColor="#25E0F0" />
      </linearGradient>
    </defs>
    <path d="M12 2c.6 4.5 3.5 7.4 8 8-4.5.6-7.4 3.5-8 8-.6-4.5-3.5-7.4-8-8 4.5-.6 7.4-3.5 8-8z" fill="url(#asst-grad)" />
  </svg>
)

function speak(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'es-AR'
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
  } catch {
    // speechSynthesis unavailable — silently ignore
  }
}

export default function AsistenteWidget() {
  const { mensajes, enviando, enviar } = useAsistente()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [attn, setAttn] = useState(true)
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const voz = useVoz((t) => setInput((prev) => (prev ? `${prev} ${t}` : t)))

  // Keep the conversation scrolled to the newest message.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [mensajes, enviando])

  const toggle = () => {
    setOpen((o) => !o)
    setAttn(false)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = input.trim()
    if (q === '') return
    enviar(q)
    setInput('')
  }

  const resumir = () => {
    const h1 = document.querySelector('main h1')?.textContent?.trim() ?? ''
    enviar('Resumime esta página', `${h1} (${pathname})`)
  }

  // Closed — breathing FAB with attention dot.
  if (!open) {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label="Abrir asistente de IA"
        aria-expanded={false}
        className="gfab-idle fixed bottom-28 right-5 z-50 grid h-[60px] w-[60px] place-items-center rounded-full border border-border bg-surface shadow-pop transition-transform hover:scale-105 lg:bottom-6 lg:right-6"
      >
        <Sparkle />
        {attn && (
          <span
            aria-hidden="true"
            className="attn-dot absolute -right-0.5 -top-0.5 h-[15px] w-[15px] rounded-full border-2 border-surface bg-accent-3"
          />
        )}
      </button>
    )
  }

  // Open — chat panel.
  return (
    <div
      role="complementary"
      aria-label="Asistente de IA"
      className="glow-ring fixed bottom-6 right-4 z-50 flex h-[min(560px,calc(100dvh-48px))] w-[min(384px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-border-strong bg-surface/[0.94] shadow-pop backdrop-blur-2xl sm:right-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
        <Sparkle size={24} />
        <div className="flex-1">
          <div className="font-display text-[15px] font-semibold text-text">Asistente IA-dex</div>
          <div className="dex-label text-[9px] text-accent-2">Powered by Gemini</div>
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-label="Cerrar asistente"
          className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-surface-2 text-text transition-colors hover:border-accent/60"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} aria-live="polite" className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-4 py-4">
        {mensajes.map((m, i) => {
          const isAssistant = m.role === 'assistant'
          return (
            <div key={i} className={`flex max-w-[90%] flex-col ${isAssistant ? 'self-start' : 'self-end'}`}>
              <div
                className={[
                  'rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed',
                  isAssistant
                    ? 'rounded-bl-sm border border-border bg-surface-2 text-text'
                    : 'rounded-br-sm border border-accent/35 bg-accent/[0.22] text-text',
                ].join(' ')}
              >
                {m.text}
              </div>
              {isAssistant && m.fuentes !== undefined && m.fuentes.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="dex-label text-[8.5px] text-muted">Fuentes:</span>
                  {m.fuentes.map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center rounded-md border border-accent-2/30 bg-accent-2/[0.12] px-2 py-1 text-[11px] text-accent-2"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
              {isAssistant && i > 0 && (
                <button
                  type="button"
                  onClick={() => speak(m.text)}
                  className="dex-label mt-2 inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[8.5px] text-muted transition-colors hover:text-text"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M11 5 6 9H2v6h4l5 4zM19 12a4 4 0 0 0-2-3.5" />
                  </svg>
                  Escuchar
                </button>
              )}
            </div>
          )
        })}
        {enviando && (
          <div className="dex-label self-start rounded-2xl rounded-bl-sm border border-border bg-surface-2 px-3.5 py-2.5 text-[11px] text-muted">
            Pensando…
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border px-3.5 pb-3.5 pt-3">
        <button
          type="button"
          onClick={resumir}
          disabled={enviando}
          className="dex-label mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/[0.12] px-3 py-1.5 text-[9px] text-accent-strong transition-colors hover:bg-accent/20 disabled:opacity-50"
        >
          ✦ Resumime esta página
        </button>
        <form onSubmit={submit} className="flex items-center gap-2 rounded-[13px] border border-border bg-surface-2 px-3.5 py-1.5">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Preguntá algo sobre IA…"
            aria-label="Mensaje para el asistente"
            className="min-w-0 flex-1 border-none bg-transparent text-sm text-text outline-none placeholder:text-muted"
          />
          {voz.isSupported && (
            <button
              type="button"
              aria-label={voz.isListening ? 'Detener dictado' : 'Dictar por voz'}
              onClick={() => (voz.isListening ? voz.stop() : voz.start())}
              className={`grid h-9 w-9 place-items-center rounded-lg transition-colors ${voz.isListening ? 'animate-pulse text-error' : 'text-muted hover:text-text'}`}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM5 10v2a7 7 0 0 0 14 0v-2M12 19v3" />
              </svg>
            </button>
          )}
          <button
            type="submit"
            aria-label="Enviar"
            disabled={enviando || input.trim() === ''}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent text-on-accent transition-transform hover:-translate-y-0.5 disabled:opacity-50"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}
