import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'
import PageStub from '../components/ui/PageStub'
import LoginPage from '../pages/LoginPage'
import RestablecerPage from '../pages/RestablecerPage'
import InicioPage from '../pages/InicioPage'
import CatalogoPage from '../pages/CatalogoPage'
import TemaPage from '../pages/TemaPage'
import SoftwareDetallePage from '../pages/SoftwareDetallePage'
import ClasificacionesPage from '../pages/ClasificacionesPage'
import ClasificacionDetallePage from '../pages/ClasificacionDetallePage'
import BuscarPage from '../pages/BuscarPage'
import ForoPage from '../pages/ForoPage'
import ForoTemaPage from '../pages/ForoTemaPage'
import EstadisticasPage from '../pages/EstadisticasPage'

// ---------------------------------------------------------------------------
// AppRouter — full route table per spec §AppRouter Route Table
// 11 named routes + 1 catch-all (404) = 12 entries total
// Routes 1-10 are children of AppLayout (sidebar + topbar visible)
// /login is a sibling (no layout)
// ---------------------------------------------------------------------------

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <InicioPage /> },
      { path: 'catalogo', element: <CatalogoPage /> },
      { path: 'catalogo/:temaSlug', element: <TemaPage /> },
      { path: 'software/:id', element: <SoftwareDetallePage /> },
      { path: 'clasificaciones', element: <ClasificacionesPage /> },
      { path: 'clasificaciones/:slug', element: <ClasificacionDetallePage /> },
      { path: 'buscar', element: <BuscarPage /> },
      { path: 'foro', element: <ForoPage /> },
      { path: 'foro/:id', element: <ForoTemaPage /> },
      { path: 'estadisticas', element: <EstadisticasPage /> },
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
