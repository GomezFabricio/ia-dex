import { Outlet } from 'react-router-dom'
import Topbar from './Topbar'
import Sidebar from './Sidebar'

// ---------------------------------------------------------------------------
// AppLayout — root shell for all authenticated routes
// grid: 2 cols [sidebar | content], 2 rows [topbar | scroll-area]
// No auth guards here — auth is action-level (design D3 / spec requirement)
// ---------------------------------------------------------------------------

export default function AppLayout() {
  return (
    <div className="grid grid-cols-[16rem_1fr] grid-rows-[auto_1fr] min-h-screen bg-bg text-text">
      <Topbar />
      <Sidebar />
      <main className="overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
