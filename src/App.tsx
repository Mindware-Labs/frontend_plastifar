import { Suspense } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { PageSpinner } from "./components/ui/PageSpinner";
import { ScreenErrorBoundary } from "./components/app/ScreenErrorBoundary";
import { GuestRoute, PermissionRoute, ProtectedRoute } from "./components/RouteGuards";
import { AppLayout } from "./layouts/AppLayout";
import { lazyNamed } from "./lib/lazyNamed";
import { LoginPage } from "./pages/auth/LoginPage";

// Cada pantalla es su propio fragmento: el bundle inicial lleva solo el
// armazon, el login y lo que todas comparten.
const BandejaPage = lazyNamed(() => import("./pages/bandeja/BandejaPage"), "BandejaPage");
const ForgotPasswordPage = lazyNamed(() => import("./pages/auth/ForgotPasswordPage"), "ForgotPasswordPage");
const ResetPasswordPage = lazyNamed(() => import("./pages/auth/ResetPasswordPage"), "ResetPasswordPage");
const ClaimDetailPage = lazyNamed(() => import("./pages/claims/ClaimDetailPage"), "ClaimDetailPage");
const ClaimPrintPage = lazyNamed(() => import("./pages/claims/ClaimPrintPage"), "ClaimPrintPage");
const ClaimsPage = lazyNamed(() => import("./pages/claims/ClaimsPage"), "ClaimsPage");
const ClientDetailPage = lazyNamed(() => import("./pages/clients/ClientDetailPage"), "ClientDetailPage");
const ClientsPage = lazyNamed(() => import("./pages/clients/ClientsPage"), "ClientsPage");
const CXDashboard = lazyNamed(() => import("./features/cx-dashboard"), "CXDashboard");
const DashboardPage = lazyNamed(() => import("./pages/dashboard/DashboardPage"), "DashboardPage");
const DiscrepanciesPage = lazyNamed(() => import("./pages/discrepancies/DiscrepanciesPage"), "DiscrepanciesPage");
const DiscrepancyDetailPage = lazyNamed(() => import("./pages/discrepancies/DiscrepancyDetailPage"), "DiscrepancyDetailPage");
const DiscrepancyPrintPage = lazyNamed(() => import("./pages/discrepancies/DiscrepancyPrintPage"), "DiscrepancyPrintPage");
const WithdrawalDetailPage = lazyNamed(() => import("./pages/withdrawals/WithdrawalDetailPage"), "WithdrawalDetailPage");
const WithdrawalPrintPage = lazyNamed(() => import("./pages/withdrawals/WithdrawalPrintPage"), "WithdrawalPrintPage");
const WithdrawalsPage = lazyNamed(() => import("./pages/withdrawals/WithdrawalsPage"), "WithdrawalsPage");
const CreditRequestsPage = lazyNamed(() => import("./pages/quality/CreditRequestsPage"), "CreditRequestsPage");
const HcaDetailPage = lazyNamed(() => import("./pages/quality/HcaDetailPage"), "HcaDetailPage");
const HcaPage = lazyNamed(() => import("./pages/quality/HcaPage"), "HcaPage");
const HcaPrintPage = lazyNamed(() => import("./pages/quality/HcaPrintPage"), "HcaPrintPage");
const ReportsPage = lazyNamed(() => import("./pages/reports/ReportsPage"), "ReportsPage");
const DepartmentsPage = lazyNamed(() => import("./pages/departments/DepartmentsPage"), "DepartmentsPage");
const SedesPage = lazyNamed(() => import("./pages/sedes/SedesPage"), "SedesPage");
const MotivosPage = lazyNamed(() => import("./pages/tickets/MotivosPage"), "MotivosPage");
const RolesPage = lazyNamed(() => import("./pages/roles/RolesPage"), "RolesPage");
const VeredictosPage = lazyNamed(() => import("./pages/tickets/VeredictosPage"), "VeredictosPage");
const HolidaysSection = lazyNamed(() => import("./pages/settings/HolidaysSection"), "HolidaysSection");
const MailboxesSection = lazyNamed(() => import("./pages/settings/MailboxesSection"), "MailboxesSection");
const PlantsSection = lazyNamed(() => import("./pages/settings/PlantsSection"), "PlantsSection");
const ProductLinesSection = lazyNamed(() => import("./pages/settings/ProductLinesSection"), "ProductLinesSection");
const ProductsSection = lazyNamed(() => import("./pages/settings/ProductsSection"), "ProductsSection");
const SlaSection = lazyNamed(() => import("./pages/settings/SlaSection"), "SlaSection");
const TeamsSection = lazyNamed(() => import("./pages/settings/TeamsSection"), "TeamsSection");
const TaskTypesSection = lazyNamed(() => import("./pages/settings/TaskTypesSection"), "TaskTypesSection");
const FormRoutingRulesSection = lazyNamed(() => import("./pages/settings/FormRoutingRulesSection"), "FormRoutingRulesSection");
const TemplatesSection = lazyNamed(() => import("./pages/settings/TemplatesSection"), "TemplatesSection");
const TerritoriesSection = lazyNamed(() => import("./pages/settings/TerritoriesSection"), "TerritoriesSection");
const StaffDetailPage = lazyNamed(() => import("./pages/staff/StaffDetailPage"), "StaffDetailPage");
const StaffPage = lazyNamed(() => import("./pages/staff/StaffPage"), "StaffPage");
const RespuestasPage = lazyNamed(() => import("./pages/respuestas/RespuestasPage"), "RespuestasPage");
const TicketDetailPage = lazyNamed(() => import("./pages/tickets/TicketDetailPage"), "TicketDetailPage");
const TicketsPage = lazyNamed(() => import("./pages/tickets/TicketsPage"), "TicketsPage");

export default function App() {
  const { pathname } = useLocation();

  return (
    <ScreenErrorBoundary resetKey={pathname}>
      <Suspense fallback={<PageSpinner />}>
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
              <Route path="/permisos" element={<Navigate to="/roles?tab=permisos" replace />} />
            </Route>

            {/* El organigrama decide hasta donde llega un rol, asi que se
                administra donde se administran los roles. La lectura queda abierta
                como la de los demas catalogos (seccion 8.4); escribir exige
                settings.write y lo comprueba el servidor en cada endpoint. */}
            <Route path="/departamentos" element={<DepartmentsPage />} />
            <Route path="/sedes" element={<SedesPage />} />

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
      </Suspense>
    </ScreenErrorBoundary>
  );
}
