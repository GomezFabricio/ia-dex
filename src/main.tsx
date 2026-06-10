import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import { AuthProvider } from './context/AuthContext'
import LoginPage from './pages/LoginPage'

// Temporary root until AppRouter lands in the next slice.
// LoginPage uses useNavigate, so it must render inside a router context.
// TODO(PR-2): replace with AppRouter
const tempRouter = createBrowserRouter([{ path: '*', element: <LoginPage /> }])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={tempRouter} />
    </AuthProvider>
  </StrictMode>,
)
