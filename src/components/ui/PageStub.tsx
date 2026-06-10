// ---------------------------------------------------------------------------
// PageStub — shared stub component for all non-login page stubs (design D6)
// Renders a page title and a "coming soon" message in Spanish.
// 404 pages use title="404" and the optional message prop.
// ---------------------------------------------------------------------------

type Props = {
  title: string
  message?: string
}

export default function PageStub({ title, message = 'Esta sección estará disponible próximamente.' }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-text">{title}</h1>
      <p className="text-muted">{message}</p>
    </div>
  )
}
