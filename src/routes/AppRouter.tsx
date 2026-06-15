import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'
import PageStub from '../components/ui/PageStub'
import LoginPage from '../pages/LoginPage'
import RestablecerPage from '../pages/RestablecerPage'
import InicioPage from '../pages/InicioPage'
import RoadmapPage from '../pages/RoadmapPage'
import CatalogoPage from '../pages/CatalogoPage'
import TemaPage from '../pages/TemaPage'
import SoftwareDetallePage from '../pages/SoftwareDetallePage'
import ClasificacionesPage from '../pages/ClasificacionesPage'
import ClasificacionDetallePage from '../pages/ClasificacionDetallePage'
import BlogPage from '../pages/BlogPage'
import PublicacionDetallePage from '../pages/PublicacionDetallePage'
import BuscarPage from '../pages/BuscarPage'
import ForoPage from '../pages/ForoPage'
import ForoTemaPage from '../pages/ForoTemaPage'
import EstadisticasPage from '../pages/EstadisticasPage'
import RequireAdmin from '../components/auth/RequireAdmin'
import PublicacionesAdminPage from '../pages/admin/PublicacionesAdminPage'
import PublicacionFormPage from '../pages/admin/PublicacionFormPage'

// ---------------------------------------------------------------------------
// AppRouter — full route table per spec §AppRouter Route Table
// Named routes + a catch-all (404) under AppLayout (sidebar + scroll chrome).
// /login and /restablecer are siblings (no layout).
// ---------------------------------------------------------------------------

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <InicioPage /> },
      { path: 'roadmap', element: <RoadmapPage /> },
      { path: 'catalogo', element: <CatalogoPage /> },
      { path: 'catalogo/:temaSlug', element: <TemaPage /> },
      { path: 'software/:slug', element: <SoftwareDetallePage /> },
      { path: 'clasificaciones', element: <ClasificacionesPage /> },
      { path: 'clasificaciones/:slug', element: <ClasificacionDetallePage /> },
      { path: 'blog', element: <BlogPage /> },
      { path: 'blog/:slug', element: <PublicacionDetallePage /> },
      { path: 'buscar', element: <BuscarPage /> },
      { path: 'foro', element: <ForoPage /> },
      { path: 'foro/:id', element: <ForoTemaPage /> },
      { path: 'estadisticas', element: <EstadisticasPage /> },
      // Admin write path — gated by RequireAdmin (UI convenience only; RLS is
      // the authoritative enforcement). Layout route: RequireAdmin renders an
      // <Outlet/> for the children when the caller is a resolved admin.
      {
        path: 'admin/publicaciones',
        element: <RequireAdmin />,
        children: [
          { index: true, element: <PublicacionesAdminPage /> },
          { path: 'nuevo', element: <PublicacionFormPage /> },
          { path: ':id/editar', element: <PublicacionFormPage /> },
        ],
      },
      {
        path: '*',
        element: <PageStub title="404" message="La página solicitada no existe." />,
      },
    ],
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/restablecer',
    element: <RestablecerPage />,
  },
])

export default function AppRouter() {
  return <RouterProvider router={router} />
}
