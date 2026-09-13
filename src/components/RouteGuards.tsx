import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { Spinner } from "./ui/Spinner";

/** Pantalla entera con un giro: sirve mientras se restaura la sesion o se descarga una pagina. */
export function FullScreenSpinner({ label }: { label: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas">
      <Spinner size="lg" label={label} />
    </div>
  );
}

function RestoringSession() {
  return <FullScreenSpinner label="Restableciendo sesión..." />;
}

/** Exige sesion. Sin ella manda al login recordando a donde se queria ir. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <RestoringSession />;
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  }

  return <>{children}</>;
}

/** Solo administradores: el backend ya rechaza al resto, asi que aqui se evita la pantalla de error. */
export function AdminRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  if (!user?.isAdmin) return <Navigate to="/" replace />;

  return <>{children}</>;
}

/** Solo sin sesion: con una abierta, las pantallas de acceso no tienen sentido. */
export function GuestRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <RestoringSession />;
  if (user) return <Navigate to="/" replace />;

  return <>{children}</>;
}
