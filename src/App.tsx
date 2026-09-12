import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { GuestRoute, PermissionRoute, ProtectedRoute } from "./components/RouteGuards";
import { AppLayout } from "./layouts/AppLayout";
import { BandejaPage } from "./pages/bandeja/BandejaPage";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage";
import { ClientDetailPage } from "./pages/clients/ClientDetailPage";
import { ClientsPage } from "./pages/clients/ClientsPage";
import { CXDashboard } from "./features/cx-dashboard";
import { DashboardPage } from "./pages/dashboard/DashboardPage";
import { PermissionsPage } from "./pages/permissions/PermissionsPage";
import { CreditRequestsPage } from "./pages/quality/CreditRequestsPage";
import { HcaDetailPage } from "./pages/quality/HcaDetailPage";
import { HcaPage } from "./pages/quality/HcaPage";
import { ReportsPage } from "./pages/reports/ReportsPage";
import { RolesPage } from "./pages/roles/RolesPage";
import { HolidaysSection } from "./pages/settings/HolidaysSection";
import { MailboxesSection } from "./pages/settings/MailboxesSection";
import { ProductLinesSection } from "./pages/settings/ProductLinesSection";
import { SlaSection } from "./pages/settings/SlaSection";
import { TemplatesSection } from "./pages/settings/TemplatesSection";
import { TerritoriesSection } from "./pages/settings/TerritoriesSection";
import { TopicsSection } from "./pages/settings/TopicsSection";
import { StaffDetailPage } from "./pages/staff/StaffDetailPage";
import { StaffPage } from "./pages/staff/StaffPage";
import { RespuestasPage } from "./pages/respuestas/RespuestasPage";
import { TicketDetailPage } from "./pages/tickets/TicketDetailPage";
import { TicketsPage } from "./pages/tickets/TicketsPage";

export default function App() {
  return (
    <Routes>
      <Route
        element={
          <GuestRoute>
            <Outlet />
          </GuestRoute>
        }
      >
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* Tablero CX. Se monta dentro del layout: el riel, la barra superior y
            el shell exterior del mock quedaron fuera a proposito, porque la
            aplicacion ya los provee. El tablero de reportes reales sigue en
            /dashboard-calidad. */}
        <Route path="/dashboard" element={<CXDashboard />} />
        <Route path="/dashboard-calidad" element={<DashboardPage />} />

        {/* Bandeja de tickets y correo (modulo de Richard De Leon). Lleva el
            mismo guard de lectura que el resto: la seccion 6.2 define
            tickets.read y RF-P6 pide que la interfaz no ofrezca lo que el
            servidor va a rechazar. */}
        <Route element={<PermissionRoute permission="tickets.read"><Outlet /></PermissionRoute>}>
          <Route path="/tickets" element={<TicketsPage />} />
          <Route path="/tickets/:id" element={<TicketDetailPage />} />
          <Route path="/bandeja" element={<BandejaPage folder="inbox" />} />
          <Route path="/bandeja/destacados" element={<BandejaPage folder="starred" />} />
          <Route path="/bandeja/archivados" element={<BandejaPage folder="archived" />} />
          <Route path="/bandeja/enviados" element={<BandejaPage folder="sent" />} />
          <Route path="/bandeja/papelera" element={<BandejaPage folder="trash" />} />
          {/* La rama de Bandeja colapso Junk en Destacados. Se redirige en vez de
              caer al 404: es un enlace que la operacion ya tiene guardado. */}
          <Route path="/bandeja/junk" element={<Navigate to="/bandeja/destacados" replace />} />
          <Route path="/bandeja/respuestas" element={<RespuestasPage />} />
        </Route>

        {/* RF-P6: cada familia de rutas declara el permiso de lectura que exige,
            el mismo que el endpoint que va a consultar. */}
        <Route element={<PermissionRoute permission="staff.read"><Outlet /></PermissionRoute>}>
          <Route path="/staff" element={<StaffPage />} />
          <Route path="/staff/:id" element={<StaffDetailPage section="datos" />} />
          <Route path="/staff/:id/accesos" element={<StaffDetailPage section="accesos" />} />
        </Route>

        <Route element={<PermissionRoute permission="roles.read"><Outlet /></PermissionRoute>}>
          <Route path="/roles" element={<RolesPage />} />
          <Route path="/permisos" element={<PermissionsPage />} />
        </Route>

        <Route element={<PermissionRoute permission="clients.read"><Outlet /></PermissionRoute>}>
          <Route path="/clientes" element={<ClientsPage />} />
          <Route path="/clientes/:id" element={<ClientDetailPage section="datos" />} />
          <Route path="/clientes/:id/contactos" element={<ClientDetailPage section="contactos" />} />
          <Route path="/clientes/:id/historial" element={<ClientDetailPage section="historial" />} />
        </Route>

        <Route element={<PermissionRoute permission="quality.read"><Outlet /></PermissionRoute>}>
          <Route path="/calidad" element={<Navigate to="/calidad/hca" replace />} />
          <Route path="/calidad/hca" element={<HcaPage />} />
          <Route path="/calidad/hca/:id" element={<HcaDetailPage section="datos" />} />
          <Route path="/calidad/hca/:id/plan" element={<HcaDetailPage section="plan" />} />
          <Route path="/calidad/hca/:id/cierre" element={<HcaDetailPage section="cierre" />} />
          <Route path="/calidad/creditos" element={<CreditRequestsPage />} />
        </Route>

        {/* Configuracion no lleva guard de lectura a proposito: la seccion 8.4 del
            plan abre la lectura de catalogos a todo el personal autenticado y solo
            exige settings.write para escribir, que es lo que cada seccion ya gatea. */}
        <Route path="/configuracion" element={<Navigate to="/configuracion/motivos" replace />} />
        <Route path="/configuracion/motivos" element={<TopicsSection />} />
        <Route path="/configuracion/sla" element={<SlaSection />} />
        <Route path="/configuracion/feriados" element={<HolidaysSection />} />
        <Route path="/configuracion/lineas" element={<ProductLinesSection />} />
        <Route path="/configuracion/plantillas" element={<TemplatesSection />} />
        <Route path="/configuracion/buzones" element={<MailboxesSection />} />
        <Route path="/configuracion/territorios" element={<TerritoriesSection />} />

        {/* El servidor ya exige reports.read en los tres endpoints; sin este
            guard la pantalla se pintaba entera y se llenaba de 403. */}
        <Route element={<PermissionRoute permission="reports.read"><Outlet /></PermissionRoute>}>
          <Route path="/reportes" element={<ReportsPage />} />

          {/* Las siete rutas de familia se colapsaron en el generador. Se dejan
              redirigiendo en vez de caer al 404 global: son enlaces que la gente
              tiene guardados y compartidos por chat, y las tres que si tenian
              datos abren directamente su reporte. */}
          <Route
            path="/reportes/calidad"
            element={<Navigate to="/reportes?reporte=hca-por-periodo" replace />}
          />
          <Route
            path="/reportes/clientes"
            element={<Navigate to="/reportes?reporte=cartera-por-territorio" replace />}
          />
          <Route
            path="/reportes/auditoria"
            element={<Navigate to="/reportes?reporte=bitacora-completa" replace />}
          />
          <Route path="/reportes/:familia" element={<Navigate to="/reportes" replace />} />
        </Route>

        {/* La raiz entra a la Bandeja, no al Dashboard: es donde la operacion
            pasa el dia (seccion 9.1). Criterio de la rama de Richard. */}
        <Route path="/" element={<Navigate to="/bandeja" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
