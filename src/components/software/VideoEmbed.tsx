import { toEmbedUrl } from '../../lib/youtube'

// ---------------------------------------------------------------------------
// VideoEmbed — renders a YouTube iframe when url resolves to a valid embed URL.
// Returns null (no DOM node) when toEmbedUrl gives null — no error, no fallback.
// Accessibility: title={nombre} required by spec (non-empty, set by caller).
// ---------------------------------------------------------------------------

type Props = {
  url: string | null | undefined
  nombre: string
}

export default function VideoEmbed({ url, nombre }: Props) {
  const embed = toEmbedUrl(url)

  if (!embed) return null

  return (
    <div className="aspect-video w-full">
      <iframe
        src={embed}
        title={nombre}
        className="w-full h-full rounded-lg border-0"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      />
    </div>
  )
}
