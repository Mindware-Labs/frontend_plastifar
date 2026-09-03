import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { GuestRoute, ProtectedRoute } from "./components/RouteGuards";
import { AppLayout } from "./layouts/AppLayout";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage";
import { PermissionsPage } from "./pages/permissions/PermissionsPage";
import { RolesPage } from "./pages/roles/RolesPage";
import { HolidaysSection } from "./pages/settings/HolidaysSection";
import { ProductLinesSection } from "./pages/settings/ProductLinesSection";
import { SlaSection } from "./pages/settings/SlaSection";
import { TemplatesSection } from "./pages/settings/TemplatesSection";
import { TopicsSection } from "./pages/settings/TopicsSection";
import { StaffDetailPage } from "./pages/staff/StaffDetailPage";
import { StaffPage } from "./pages/staff/StaffPage";

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
        <Route path="/staff" element={<StaffPage />} />
        <Route path="/staff/:id" element={<StaffDetailPage section="datos" />} />
        <Route path="/staff/:id/accesos" element={<StaffDetailPage section="accesos" />} />
        <Route path="/roles" element={<RolesPage />} />
        <Route path="/permisos" element={<PermissionsPage />} />

        <Route path="/configuracion" element={<Navigate to="/configuracion/motivos" replace />} />
        <Route path="/configuracion/motivos" element={<TopicsSection />} />
        <Route path="/configuracion/sla" element={<SlaSection />} />
        <Route path="/configuracion/feriados" element={<HolidaysSection />} />
        <Route path="/configuracion/lineas" element={<ProductLinesSection />} />
        <Route path="/configuracion/plantillas" element={<TemplatesSection />} />
        <Route path="/" element={<Navigate to="/staff" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
