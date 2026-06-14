import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import MobileNav from './MobileNav'
import ThemeToggle from '../ui/ThemeToggle'
import { buildBreadcrumb } from './breadcrumb'
import { RequireAuthProvider } from '../../context/RequireAuthProvider'
import { useMediaQuery } from '../../hooks/useMediaQuery'

// ---------------------------------------------------------------------------
// AppLayout — root shell for all routes.
// One navigation surface: a full-height frosted sidebar (brand + profile + nav).
// Desktop (lg+): 2-col grid [sidebar | content]. Mobile: single column with a
// bottom-right thumb-zone drawer (MobileNav).
//
// <main> is edge-to-edge (no padding): full-bleed pages (the home hero) render
// to the very edges, while every other route gets a centered, padded container.
// A scroll-reactive top chrome bar sits over the content — transparent above the
// hero, then "docks" (frosted bar + breadcrumb fade-in) once a 0-height sentinel
// at the top of the scroll container leaves the viewport. IntersectionObserver,
// not a per-frame scroll listener.
// No auth guards here — auth is action-level (design D3).
// ---------------------------------------------------------------------------

// Routes whose page owns a full-bleed (edge-to-edge) layout. As redesign phases
// land their heroes, extend this predicate. Detail routes are matched by prefix
// (e.g. /software/:id), so it can't be a plain Set of exact paths. Everything
// else falls back to the centered, padded shell.
function isFullBleedPath(pathname: string): boolean {
  if (pathname === '/') return true
  if (pathname === '/roadmap') return true
  if (pathname.startsWith('/software/')) return true
  if (pathname.startsWith('/clasificaciones/')) return true
  return false
}

export default function AppLayout() {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const { pathname } = useLocation()
  const isFullBleed = isFullBleedPath(pathname)

  const sentinelRef = useRef<HTMLDivElement>(null)
  const [docked, setDocked] = useState(false)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => setDocked(!entry.isIntersecting),
      { threshold: 0 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <RequireAuthProvider>
      <div className="relative isolate grid h-dvh grid-cols-1 grid-rows-1 overflow-hidden bg-bg text-text lg:grid-cols-[18rem_1fr]">
        {/* Ambient color field — revealed through the frosted sidebar (glass). */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -left-24 -top-24 h-[28rem] w-[28rem] rounded-full bg-accent/25 blur-[120px]" />
          <div className="absolute -left-16 top-1/3 h-96 w-96 rounded-full bg-accent-2/20 blur-[120px]" />
        </div>

        {isDesktop ? <Sidebar /> : <MobileNav />}

        <main className="relative overflow-x-hidden overflow-y-auto pb-24 lg:pb-0">
          {/* Sentinel — drives the chrome dock state (0-height, top of scroll). */}
          <div ref={sentinelRef} aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-16" />

          {/* Top chrome — sticky bar: transparent over the hero, frosted on scroll. */}
          <div
            className={[
              'sticky top-0 z-40 flex h-14 items-center gap-3 px-4 transition-colors duration-300 sm:px-8',
              docked ? 'border-b border-border/70 bg-bg/65 backdrop-blur-xl' : 'border-b border-transparent',
            ].join(' ')}
          >
            <span
              className={[
                'dex-label min-w-0 flex-1 truncate text-[10px] text-muted transition-opacity duration-300',
                docked ? 'opacity-100' : 'opacity-0',
              ].join(' ')}
            >
              {buildBreadcrumb(pathname)}
            </span>
            {isDesktop && <ThemeToggle />}
          </div>

          {/* Page content. Full-bleed pages render edge-to-edge and pull up under
              the transparent chrome; the rest get a centered, padded container. */}
          {isFullBleed ? (
            <div className="-mt-14">
              <Outlet />
            </div>
          ) : (
            <div className="mx-auto w-full max-w-[1400px] px-4 pt-2 pb-12 sm:px-8">
              <Outlet />
            </div>
          )}
        </main>
      </div>
    </RequireAuthProvider>
  )
}
