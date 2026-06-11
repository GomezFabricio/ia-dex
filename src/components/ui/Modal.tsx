import { useEffect, useRef } from 'react'

// ---------------------------------------------------------------------------
// Modal — accessible dialog built on the native <dialog> element.
// Opened with showModal() so it lands in the top layer with focus trapping and
// native Esc handling. Light-dismiss (click on backdrop) is handled manually
// since the `closedby` attribute is not yet supported everywhere (no Safari).
// ---------------------------------------------------------------------------

type Props = {
  open: boolean
  onClose: () => void
  labelledBy?: string
  children: React.ReactNode
}

export default function Modal({ open, onClose, labelledBy, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  // Sync the imperative <dialog> state with the `open` prop.
  useEffect(() => {
    const dlg = ref.current
    if (!dlg) return
    if (open && !dlg.open) dlg.showModal()
    else if (!open && dlg.open) dlg.close()
  }, [open])

  // Native close (Esc / programmatic) → notify parent so state stays in sync.
  useEffect(() => {
    const dlg = ref.current
    if (!dlg) return
    const handleClose = () => onClose()
    dlg.addEventListener('close', handleClose)
    return () => dlg.removeEventListener('close', handleClose)
  }, [onClose])

  // Light-dismiss: a click whose target is the dialog itself lands on the
  // backdrop (content is wrapped), so close.
  const handleClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === ref.current) ref.current?.close()
  }

  return (
    <dialog
      ref={ref}
      onClick={handleClick}
      aria-labelledby={labelledBy}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-border bg-surface p-6 text-text shadow-pop"
    >
      <div className="flex flex-col gap-4">{children}</div>
    </dialog>
  )
}
