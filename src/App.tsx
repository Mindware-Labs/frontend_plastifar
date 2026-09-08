import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { GuestRoute, ProtectedRoute } from "./components/RouteGuards";
import { AppLayout } from "./layouts/AppLayout";
import { BandejaPage } from "./pages/bandeja/BandejaPage";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage";
import { RolesPage } from "./pages/roles/RolesPage";
import { StaffPage } from "./pages/staff/StaffPage";
import { RespuestasPage } from "./pages/respuestas/RespuestasPage";
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
        <Route path="/tickets" element={<TicketsPage />} />
        <Route path="/bandeja" element={<BandejaPage folder="inbox" />} />
        <Route path="/bandeja/destacados" element={<BandejaPage folder="starred" />} />
        <Route path="/bandeja/junk" element={<Navigate to="/bandeja/destacados" replace />} />
        <Route path="/bandeja/archivados" element={<BandejaPage folder="archived" />} />
        <Route path="/bandeja/papelera" element={<BandejaPage folder="trash" />} />
        <Route path="/bandeja/enviados" element={<BandejaPage folder="sent" />} />
        <Route path="/bandeja/respuestas" element={<RespuestasPage />} />
        <Route path="/staff" element={<StaffPage />} />
        <Route path="/roles" element={<RolesPage />} />
        <Route path="/" element={<Navigate to="/bandeja" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
