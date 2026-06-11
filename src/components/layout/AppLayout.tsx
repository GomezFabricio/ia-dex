import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import MobileNav from './MobileNav'
import ThemeToggle from '../ui/ThemeToggle'
import { RequireAuthProvider } from '../../context/RequireAuthProvider'
import { useMediaQuery } from '../../hooks/useMediaQuery'

// ---------------------------------------------------------------------------
// AppLayout — root shell for all routes.
// One navigation surface: a full-height sidebar (brand + profile + nav). No
// header. Desktop (lg+): 2-col grid [sidebar | content]. Mobile: single column
// with a bottom-right thumb-zone drawer (MobileNav). Rendering one OR the other
// keeps the sidebar's data hooks fetching once.
// No auth guards here — auth is action-level (design D3).
// ---------------------------------------------------------------------------

export default function AppLayout() {
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  return (
    <RequireAuthProvider>
      <div className="relative isolate grid h-dvh grid-cols-1 grid-rows-1 overflow-hidden bg-bg text-text lg:grid-cols-[18rem_1fr]">
        {/* Decorative color field — revealed through the frosted sidebar (glass). */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -left-24 -top-24 h-[28rem] w-[28rem] rounded-full bg-accent/25 blur-[120px]" />
          <div className="absolute -left-16 top-1/3 h-96 w-96 rounded-full bg-accent-2/20 blur-[120px]" />
          <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(60%_100%_at_50%_0%,color-mix(in_oklab,var(--color-accent)_12%,transparent),transparent)]" />
        </div>

        {isDesktop ? <Sidebar /> : <MobileNav />}

        {/* Desktop theme toggle — top-right corner (mobile uses the FAB). */}
        {isDesktop && (
          <div className="fixed right-6 top-5 z-50">
            <ThemeToggle />
          </div>
        )}

        <main className="overflow-y-auto p-5 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </RequireAuthProvider>
  )
}
