// ---------------------------------------------------------------------------
// youtube.ts — pure URL helper, no React imports, no side effects
// Converts any recognized YouTube URL form to the canonical embed URL.
// Returns null for null/undefined/empty input, unrecognized hostnames,
// invalid video ids, or any malformed URL that the URL constructor rejects.
// ---------------------------------------------------------------------------

const ALLOWED_HOSTNAMES = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
])

// Minimal video-id validation: YouTube ids are 11 chars [A-Za-z0-9_-]
// but the spec asks for ≥6 to cover edge cases.
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{6,}$/

function extractVideoId(parsed: URL): string | null {
  const { hostname, pathname, searchParams } = parsed

  if (hostname === 'youtu.be') {
    // https://youtu.be/VIDEO_ID
    const segment = pathname.split('/')[1] ?? ''
    return VIDEO_ID_RE.test(segment) ? segment : null
  }

  // youtube.com family
  const parts = pathname.split('/') // ['', 'watch' | 'shorts' | 'embed' | 'live' | ...]

  if (pathname.startsWith('/watch')) {
    const v = searchParams.get('v') ?? ''
    return VIDEO_ID_RE.test(v) ? v : null
  }

  if (
    pathname.startsWith('/shorts/') ||
    pathname.startsWith('/embed/') ||
    pathname.startsWith('/live/')
  ) {
    const segment = parts[2] ?? ''
    return VIDEO_ID_RE.test(segment) ? segment : null
  }

  return null
}

/**
 * Converts any recognized YouTube URL to https://www.youtube.com/embed/{id}.
 * Returns null for null/undefined/empty input, unrecognized hostnames,
 * malformed URLs, or unrecognized path forms.
 */
export function toEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  if (!ALLOWED_HOSTNAMES.has(parsed.hostname)) return null

  const id = extractVideoId(parsed)
  if (!id) return null

  return `https://www.youtube.com/embed/${id}`
}
