import SidebarBody from './SidebarBody'

// ---------------------------------------------------------------------------
// Sidebar — desktop navigation rail (column 1 of the AppLayout grid).
// Only mounted on large screens; the mobile drawer (MobileNav) renders the same
// SidebarBody content. Primary nav stays in the Topbar on desktop.
// ---------------------------------------------------------------------------

export default function Sidebar() {
  return (
    <aside className="flex h-full flex-col overflow-hidden border-r border-border/70 bg-surface/40 backdrop-blur-2xl">
      <SidebarBody />
    </aside>
  )
}
