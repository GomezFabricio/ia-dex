import DOMPurify from 'dompurify'

// ---------------------------------------------------------------------------
// sanitizeHtml — the single trust boundary for rich-text publication bodies.
//
// The publicaciones.cuerpo column now stores an HTML string produced by the
// TipTap editor (admin) OR legacy plain text (older posts). Because the admin
// can also paste raw HTML in the source view, the stored value is UNTRUSTED at
// render time — a stored-XSS surface. EVERY read path that drops cuerpo into
// dangerouslySetInnerHTML MUST route it through sanitizeHtml first.
//
// We allow only the small tag/attr set the editor can emit (an allowlist, not a
// denylist — unknown tags/attrs are dropped). DOMPurify already neutralizes
// event handlers, dangerous URI schemes (javascript:, data:, …) and unknown
// attributes by default; the allowlist below narrows it further, and the
// afterSanitizeAttributes hook hardens every surviving anchor.
// ---------------------------------------------------------------------------

// The tags the editor can produce. Mirrors StarterKit's output plus the inline
// formatting marks. NO style/class/id — presentation comes from .dex-prose.
const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'strike',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'blockquote',
  'a',
  'code',
  'pre',
  'hr',
  'span',
]

// Anchor attributes only. href is the link target; target/rel are forced by the
// hook below (we list them so the hook's writes survive the attribute sweep).
const ALLOWED_ATTR = ['href', 'target', 'rel']

// Register the anchor-hardening hook at module load. ES modules evaluate once,
// so in production this runs a single time; under dev HMR it may re-register,
// but the hook is idempotent (it always writes the same target/rel), so a
// duplicate registration is harmless. Every surviving <a> is forced to open in a
// new tab with a hardened rel (blocks reverse-tabnabbing + tells crawlers the
// link is user-supplied).
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer nofollow')
  }
})

/**
 * Sanitizes an untrusted HTML string down to the editor's allowlist, returning
 * a safe string for dangerouslySetInnerHTML. Drops every tag/attribute outside
 * ALLOWED_TAGS/ALLOWED_ATTR; DOMPurify's built-in defenses (dangerous URI
 * schemes, event handlers) stay ON.
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  })
}

/**
 * Strips tags and decodes entities to plain text — for excerpts and word counts.
 * Uses DOMParser with 'text/html', which parses (but never EXECUTES) the markup,
 * so it is safe on untrusted input. Runs of whitespace collapse to a single
 * space and the result is trimmed. Legacy plain-text bodies (no tags) pass
 * through unchanged except for whitespace normalization.
 */
export function htmlToText(input: string): string {
  const text = new DOMParser().parseFromString(input, 'text/html').body.textContent ?? ''
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * Returns true when the string looks like editor-produced HTML. The renderer
 * uses this to tell a new HTML body apart from a legacy plain-text body (which
 * must keep its whitespace-pre-wrap rendering rather than being fed to
 * dangerouslySetInnerHTML).
 *
 * The editor ALWAYS wraps its output in a block-level element (paragraph,
 * heading, list, blockquote, code block or horizontal rule), so a body is HTML
 * iff it STARTS with one of those opening tags. Anchoring to the start — rather
 * than matching a tag anywhere — keeps legacy plain text that merely contains an
 * inline expression like "a<b>0", "x<3" or "<div>" on the safe plain-text path
 * instead of corrupting it through the HTML branch.
 */
export function looksLikeHtml(input: string): boolean {
  return /^\s*<(?:p|h[1-6]|ul|ol|blockquote|pre|hr)\b/i.test(input)
}
