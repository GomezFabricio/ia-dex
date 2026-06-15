// ---------------------------------------------------------------------------
// slug.ts — pure runtime slug helper, no React imports, no side effects.
// Form-side generator (there is no DB trigger): produces a kebab-case ASCII
// slug from a human title. (SG1)
//
// Pipeline:
//   lowercase
//   -> Unicode NFD normalize + strip diacritics (U+0300..U+036F combining marks)
//   -> replace any run of non-alphanumeric chars with a single '-'
//   -> collapse repeated dashes
//   -> trim leading/trailing dashes
//
// Example: slugify("¿Qué es la IA Débil?") === "que-es-la-ia-debil"
// ---------------------------------------------------------------------------

export function slugify(titulo: string): string {
  return titulo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritical marks
    .replace(/[^a-z0-9]+/g, '-') // non-alphanumeric runs -> single dash
    .replace(/-+/g, '-') // collapse repeated dashes
    .replace(/^-+|-+$/g, '') // trim leading/trailing dashes
}
