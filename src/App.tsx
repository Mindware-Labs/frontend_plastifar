import { Suspense, lazy } from "react";
import { Navigate, Outlet, Route, Routes, useParams } from "react-router-dom";
import { AdminRoute, FullScreenSpinner, GuestRoute, ProtectedRoute } from "./components/RouteGuards";
import { AppLayout } from "./layouts/AppLayout";

// Cada pagina en su propio trozo: el login no descarga el editor ni el visor de PDF.
const BandejaPage = lazy(() => import("./pages/bandeja/BandejaPage").then((m) => ({ default: m.BandejaPage })));
const ForgotPasswordPage = lazy(() =>
  import("./pages/auth/ForgotPasswordPage").then((m) => ({ default: m.ForgotPasswordPage })),
);
const LoginPage = lazy(() => import("./pages/auth/LoginPage").then((m) => ({ default: m.LoginPage })));
const ResetPasswordPage = lazy(() =>
  import("./pages/auth/ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage })),
);
const RolesPage = lazy(() => import("./pages/roles/RolesPage").then((m) => ({ default: m.RolesPage })));
const StaffPage = lazy(() => import("./pages/staff/StaffPage").then((m) => ({ default: m.StaffPage })));
const RespuestasPage = lazy(() =>
  import("./pages/respuestas/RespuestasPage").then((m) => ({ default: m.RespuestasPage })),
);
const TicketDetailPage = lazy(() =>
  import("./pages/tickets/TicketDetailPage").then((m) => ({ default: m.TicketDetailPage })),
);
const MotivosPage = lazy(() => import("./pages/tickets/MotivosPage").then((m) => ({ default: m.MotivosPage })));
const VeredictosPage = lazy(() =>
  import("./pages/tickets/VeredictosPage").then((m) => ({ default: m.VeredictosPage })),
);
const TicketsPage = lazy(() => import("./pages/tickets/TicketsPage").then((m) => ({ default: m.TicketsPage })));

/** Cambiar de ticket remonta la pagina: ningun estado (borrador, pestana, modales) sobrevive al anterior. */
function TicketDetailRoute() {
  const { id } = useParams<{ id: string }>();
  return <TicketDetailPage key={id} />;
}

export default function App() {
  return (
    <Suspense fallback={<FullScreenSpinner label="Cargando..." />}>
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
          <Route path="/tickets" element={<TicketsPage />} />
          <Route path="/tickets/motivos" element={<MotivosPage />} />
          <Route path="/tickets/veredictos" element={<VeredictosPage />} />
          <Route path="/tickets/:id" element={<TicketDetailRoute />} />
          <Route path="/bandeja" element={<BandejaPage folder="inbox" />} />
          <Route path="/bandeja/destacados" element={<BandejaPage folder="starred" />} />
          <Route path="/bandeja/junk" element={<Navigate to="/bandeja/destacados" replace />} />
          <Route path="/bandeja/archivados" element={<BandejaPage folder="archived" />} />
          <Route path="/bandeja/papelera" element={<BandejaPage folder="trash" />} />
          <Route path="/bandeja/enviados" element={<BandejaPage folder="sent" />} />
          <Route path="/bandeja/respuestas" element={<RespuestasPage />} />
          <Route
            path="/staff"
            element={
              <AdminRoute>
                <StaffPage />
              </AdminRoute>
            }
          />
          <Route
            path="/roles"
            element={
              <AdminRoute>
                <RolesPage />
              </AdminRoute>
            }
          />
          <Route path="/" element={<Navigate to="/bandeja" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
