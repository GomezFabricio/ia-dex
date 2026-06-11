import { useEffect, useRef, useState } from 'react'
import SidebarBody from './SidebarBody'
import ThemeToggle from '../ui/ThemeToggle'

// ---------------------------------------------------------------------------
// MobileNav — thumb-zone navigation for small screens.
// Research (Hoober): the bottom edge is the easy-reach "green" zone; the top
// corners are the hard "red" zone. So the controls float bottom-right (toggle +
// hamburger) and the drawer slides in from the right — next to the thumb that
// opened it. Dismiss: backdrop tap, Escape, or tapping a nav link.
// ---------------------------------------------------------------------------

export default function MobileNav() {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLElement>(null)

  const close = () => setOpen(false)

  useEffect(() => {
    if (!open) return
    panelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={close}
        className={`fixed inset-0 z-40 bg-[rgb(8_11_24/0.55)] backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      {/* Drawer panel (slides from the right) */}
      <aside
        ref={panelRef}
        id="mobile-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Navegación"
        tabIndex={-1}
        className={`fixed inset-y-0 right-0 z-50 flex w-72 max-w-[80vw] flex-col overflow-hidden border-l border-border bg-surface/75 backdrop-blur-2xl shadow-pop transition-transform duration-300 focus:outline-none ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <SidebarBody onNavigate={close} />
      </aside>

      {/* Thumb-zone control cluster (bottom-right) */}
      <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3">
        <ThemeToggle variant="fab" />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={open}
          aria-controls="mobile-drawer"
          className="grid h-14 w-14 place-items-center rounded-full bg-accent text-bg shadow-glow transition-transform hover:-translate-y-0.5"
        >
          {open ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          )}
        </button>
      </div>
    </>
  )
}
