import SidebarBody from './SidebarBody'

// ---------------------------------------------------------------------------
// Sidebar — desktop navigation rail (column 1 of the AppLayout grid).
// Only mounted on large screens; the mobile drawer (MobileNav) renders the same
// SidebarBody content. Primary nav stays in the Topbar on desktop.
// ---------------------------------------------------------------------------

export default function Sidebar() {
  return (
    <aside className="relative flex h-full flex-col overflow-hidden border-r border-border/70 bg-surface/40 backdrop-blur-2xl">
      {/* Ambient glows bleeding through the glass (decorative). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-12 -top-16 h-60 w-60 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--color-accent)_60%,transparent),transparent_70%)] opacity-45 blur-[60px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-14 bottom-16 h-56 w-56 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--color-accent-2)_55%,transparent),transparent_70%)] opacity-40 blur-[60px]"
      />
      <SidebarBody />
    </aside>
  )
}
