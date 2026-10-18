import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { GuestRoute, PermissionRoute, ProtectedRoute } from "./components/RouteGuards";
import { AppLayout } from "./layouts/AppLayout";
import { BandejaPage } from "./pages/bandeja/BandejaPage";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage";
import { ClaimDetailPage } from "./pages/claims/ClaimDetailPage";
import { ClaimPrintPage } from "./pages/claims/ClaimPrintPage";
import { ClaimsPage } from "./pages/claims/ClaimsPage";
import { ClientDetailPage } from "./pages/clients/ClientDetailPage";
import { ClientsPage } from "./pages/clients/ClientsPage";
import { CXDashboard } from "./features/cx-dashboard";
import { DashboardPage } from "./pages/dashboard/DashboardPage";
import { DiscrepanciesPage } from "./pages/discrepancies/DiscrepanciesPage";
import { DiscrepancyDetailPage } from "./pages/discrepancies/DiscrepancyDetailPage";
import { DiscrepancyPrintPage } from "./pages/discrepancies/DiscrepancyPrintPage";
import { WithdrawalDetailPage } from "./pages/withdrawals/WithdrawalDetailPage";
import { WithdrawalPrintPage } from "./pages/withdrawals/WithdrawalPrintPage";
import { WithdrawalsPage } from "./pages/withdrawals/WithdrawalsPage";
import { PermissionsPage } from "./pages/permissions/PermissionsPage";
import { CreditRequestsPage } from "./pages/quality/CreditRequestsPage";
import { HcaDetailPage } from "./pages/quality/HcaDetailPage";
import { HcaPage } from "./pages/quality/HcaPage";
import { HcaPrintPage } from "./pages/quality/HcaPrintPage";
import { ReportsPage } from "./pages/reports/ReportsPage";
import { DepartmentsPage } from "./pages/departments/DepartmentsPage";
import { MotivosPage } from "./pages/tickets/MotivosPage";
import { RolesPage } from "./pages/roles/RolesPage";
import { VeredictosPage } from "./pages/tickets/VeredictosPage";
import { HolidaysSection } from "./pages/settings/HolidaysSection";
import { MailboxesSection } from "./pages/settings/MailboxesSection";
import { PlantsSection } from "./pages/settings/PlantsSection";
import { ProductLinesSection } from "./pages/settings/ProductLinesSection";
import { ProductsSection } from "./pages/settings/ProductsSection";
import { SlaSection } from "./pages/settings/SlaSection";
import { TeamsSection } from "./pages/settings/TeamsSection";
import { TaskTypesSection } from "./pages/settings/TaskTypesSection";
import { FormRoutingRulesSection } from "./pages/settings/FormRoutingRulesSection";
import { TemplatesSection } from "./pages/settings/TemplatesSection";
import { TerritoriesSection } from "./pages/settings/TerritoriesSection";
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
          {/* Motivos y veredictos llegaron con la rama de Tickets. Hubo un
            tiempo en que los motivos tambien se administraban desde
            /configuracion/motivos, contra la misma entidad y con otra mitad de
            los campos. Quedo esta: un motivo es un concepto de tickets, no de
            configuracion, y dos pantallas para una tabla es como se desincronizan
            las reglas. */}
        <Route path="/tickets/motivos" element={<MotivosPage />} />
        <Route path="/tickets/veredictos" element={<VeredictosPage />} />
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

        {/* El organigrama decide hasta donde llega un rol, asi que se
            administra donde se administran los roles. La lectura queda abierta
            como la de los demas catalogos (seccion 8.4); escribir exige
            settings.write y lo comprueba el servidor en cada endpoint. */}
        <Route path="/departamentos" element={<DepartmentsPage />} />

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

        {/* Reclamación de clientes, PF-FOR-034 (docs/plan/03). Clave propia:
            la llena Ventas y la trata Calidad, y ninguna de las dos es
            quality.read. La vista de impresión va fuera del armazón, abajo. */}
        <Route element={<PermissionRoute permission="claims.read"><Outlet /></PermissionRoute>}>
          <Route path="/reclamaciones" element={<ClaimsPage />} />
          <Route path="/reclamaciones/:id" element={<ClaimDetailPage />} />
        </Route>

        {/* Investigación de discrepancia de carga, PF-FOR-291 (docs/plan/06).
            Clave propia; la vista de impresión va fuera del armazón, abajo. */}
        <Route element={<PermissionRoute permission="discrepancies.read"><Outlet /></PermissionRoute>}>
          <Route path="/discrepancias" element={<DiscrepanciesPage />} />
          <Route path="/discrepancias/:id" element={<DiscrepancyDetailPage />} />
        </Route>

        {/* Solicitud de retiro de mercancía, PF-FOR-068 (docs/plan/04). Clave
            propia; la vista de impresión va fuera del armazón, abajo. */}
        <Route element={<PermissionRoute permission="withdrawals.read"><Outlet /></PermissionRoute>}>
          <Route path="/retiros" element={<WithdrawalsPage />} />
          <Route path="/retiros/:id" element={<WithdrawalDetailPage />} />
        </Route>

        {/* Configuracion no lleva guard de lectura a proposito: la seccion 8.4 del
            plan abre la lectura de catalogos a todo el personal autenticado y solo
            exige settings.write para escribir, que es lo que cada seccion ya gatea. */}
        <Route path="/configuracion" element={<Navigate to="/configuracion/sla" replace />} />
        <Route path="/configuracion/sla" element={<SlaSection />} />
        <Route path="/configuracion/feriados" element={<HolidaysSection />} />
        <Route path="/configuracion/plantillas" element={<TemplatesSection />} />
        <Route path="/configuracion/buzones" element={<MailboxesSection />} />
        {/* Rutas propuestas en docs/plan/00, seccion 11. Si los productos y las
            plantas deben seguir a las lineas de producto al grupo de Calidad
            esta por decidir en la revision cruzada. */}
        <Route path="/configuracion/productos" element={<ProductsSection />} />
        <Route path="/configuracion/plantas" element={<PlantsSection />} />
        <Route path="/configuracion/equipos" element={<TeamsSection />} />
        {/* Catalogo de tareas y enrutamiento de formularios (docs/plan/02,
            seccion 11): la parte del documento que no toca la Bandeja. */}
        <Route path="/configuracion/tipos-de-tarea" element={<TaskTypesSection />} />
        <Route path="/configuracion/formularios" element={<FormRoutingRulesSection />} />

        {/* Territorios y lineas de producto se mudaron al modulo que las usa:
            el territorio es obligatorio al registrar un cliente y alimenta el
            ranking por zona; la linea de producto es el eje por el que Calidad
            sigue las reclamaciones. Ninguna de las dos es configuracion del
            sistema, y en «Configuracion» solo estaban porque era el cajon. */}
        <Route path="/clientes/territorios" element={<TerritoriesSection />} />
        <Route path="/calidad/lineas" element={<ProductLinesSection />} />

        {/* Las rutas viejas siguen respondiendo. Estan en marcadores, en
            correos y en la memoria de quien lleva un año usando el panel;
            moverlas sin dejar el rastro convierte una reorganizacion del menu
            en un enlace roto. */}
        <Route path="/configuracion/territorios" element={<Navigate to="/clientes/territorios" replace />} />
        <Route path="/configuracion/lineas" element={<Navigate to="/calidad/lineas" replace />} />

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

      {/* Vistas de impresión de los formularios (docs/plan/03 RF-R9, 05 RF-H10,
          06 RF-D8): con sesión pero sin el armazón, para que la barra lateral
          no salga en el papel. */}
      <Route
        element={
          <ProtectedRoute>
            <Outlet />
          </ProtectedRoute>
        }
      >
        <Route
          path="/reclamaciones/:id/imprimir"
          element={
            <PermissionRoute permission="claims.read">
              <ClaimPrintPage />
            </PermissionRoute>
          }
        />
        <Route
          path="/calidad/hca/:id/imprimir"
          element={
            <PermissionRoute permission="quality.read">
              <HcaPrintPage />
            </PermissionRoute>
          }
        />
        <Route
          path="/discrepancias/:id/imprimir"
          element={
            <PermissionRoute permission="discrepancies.read">
              <DiscrepancyPrintPage />
            </PermissionRoute>
          }
        />
        <Route
          path="/retiros/:id/imprimir"
          element={
            <PermissionRoute permission="withdrawals.read">
              <WithdrawalPrintPage />
            </PermissionRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
