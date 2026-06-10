import { NavLink } from 'react-router-dom'
import { useTemas } from '../../hooks/useTemas'
import { useClasificaciones } from '../../hooks/useClasificaciones'

// ---------------------------------------------------------------------------
// Sidebar — navigation rail with two DB-driven sections
// Section 1 (eje 1): temas → /catalogo/:slug
// Section 2 (eje 2): clasificaciones SI → /clasificaciones/:slug
// Graceful degradation: loading = 3 pulse skeletons; error = message + retry button
// AppLayout never unmounts on error (spec requirement)
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-2 mt-1">
      {[0, 1, 2].map((i) => (
        <div key={i} className="animate-pulse bg-surface h-4 rounded w-3/4" />
      ))}
    </div>
  )
}

type NavSectionProps = {
  loading: boolean
  error: Error | null
  refetch: () => void
  children: React.ReactNode
}

function NavSection({ loading, error, refetch, children }: NavSectionProps) {
  if (loading) return <LoadingSkeleton />
  if (error) {
    return (
      <div className="flex flex-col gap-2 mt-1">
        <p className="text-sm text-muted">No se pudieron cargar los datos</p>
        <button
          onClick={refetch}
          className="text-sm text-accent hover:text-text transition-colors self-start"
        >
          Reintentar
        </button>
      </div>
    )
  }
  return <>{children}</>
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive
    ? 'block px-3 py-1.5 rounded text-sm bg-surface text-accent'
    : 'block px-3 py-1.5 rounded text-sm text-muted hover:text-text transition-colors'

export default function Sidebar() {
  const temas = useTemas()
  const clasificaciones = useClasificaciones()

  return (
    <aside className="bg-bg border-r border-surface p-4 flex flex-col gap-6 overflow-y-auto">
      <nav>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
          Temas
        </p>
        <NavSection loading={temas.loading} error={temas.error} refetch={temas.refetch}>
          <ul className="flex flex-col gap-0.5">
            {temas.data.map((tema) => (
              <li key={tema.id}>
                <NavLink to={`/catalogo/${tema.slug}`} className={navLinkClass}>
                  {tema.nombre}
                </NavLink>
              </li>
            ))}
          </ul>
        </NavSection>
      </nav>

      <nav>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
          Clasificaciones de SI
        </p>
        <NavSection
          loading={clasificaciones.loading}
          error={clasificaciones.error}
          refetch={clasificaciones.refetch}
        >
          <ul className="flex flex-col gap-0.5">
            {clasificaciones.data.map((clf) => (
              <li key={clf.id}>
                <NavLink to={`/clasificaciones/${clf.slug}`} className={navLinkClass}>
                  {clf.nombre}
                </NavLink>
              </li>
            ))}
          </ul>
        </NavSection>
      </nav>
    </aside>
  )
}
