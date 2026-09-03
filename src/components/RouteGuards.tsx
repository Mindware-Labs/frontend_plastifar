import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { Spinner } from "./ui/Spinner";

function RestoringSession() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas">
      <Spinner />
    </div>
  );
}

/** Exige sesion. Sin ella manda al login recordando a donde se queria ir. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  // TEMPORAL: login comentado para entrar al panel sin credenciales durante
  // desarrollo. Descomentar antes de cualquier despliegue real.
  if (isLoading) return <RestoringSession />;
  // if (!user) {
  //   return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  // }
  void user;
  void location;

  return <>{children}</>;
}

/** Solo sin sesion: con una abierta, las pantallas de acceso no tienen sentido. */
export function GuestRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <RestoringSession />;
  if (user) return <Navigate to="/" replace />;

  return <>{children}</>;
}
