// ---------------------------------------------------------------------------
// date.ts — shared date formatting utilities
// formatFecha: formats ISO timestamps in es-AR short locale for display.
// Returns '' for null, empty, or invalid input — never throws.
// PR-3 (foro-thread/MensajeItem) depends on this export.
// ---------------------------------------------------------------------------

const formatter = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

export function formatFecha(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return formatter.format(d)
}
