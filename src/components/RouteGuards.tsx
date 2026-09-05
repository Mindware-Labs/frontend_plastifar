import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { usePermissions } from "../hooks/usePermissions";
import type { PermissionKey } from "../lib/permissions";
import { Alert } from "./ui/Alert";
import { Spinner } from "./ui/Spinner";

/**
 * Puerta trasera de desarrollo: entra al panel sin credenciales.
 *
 * Antes esto era el guard de sesion comentado con un "descomentar antes de
 * desplegar" al lado, que es exactamente la clase de nota que nadie lee el dia
 * que se despliega. Ahora es una variable de entorno que hay que encender a
 * proposito: el valor por defecto es seguro, y una compilacion de produccion
 * que no la declara no puede quedar abierta por olvido.
 */
const AUTH_BYPASS = import.meta.env.DEV && import.meta.env.VITE_AUTH_BYPASS === "true";

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

  if (isLoading) return <RestoringSession />;
  if (!user && !AUTH_BYPASS) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  }

  return <>{children}</>;
}

/** Solo sin sesion: con una abierta, las pantallas de acceso no tienen sentido. */
export function GuestRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <RestoringSession />;
  if (user) return <Navigate to="/" replace />;

  return <>{children}</>;
}

/**
 * RF-P6: la interfaz oculta lo que la persona no puede hacer, ademas de que el
 * servidor lo rechace. Sin esto una ruta sin permiso se pinta entera y se
 * llena de 403 al primer fetch, que es peor que decirlo de entrada.
 *
 * No navega a otra pantalla: explica en su sitio. Un redirect silencioso deja
 * a la persona sin saber si se equivoco de enlace o si le falta el acceso.
 */
export function PermissionRoute({
  permission,
  children,
}: {
  permission: PermissionKey;
  children: ReactNode;
}) {
  const { user } = useAuth();
  const { can } = usePermissions();

  // Sin sesion no hay permisos que evaluar: con la puerta trasera abierta se
  // deja pasar, o si no ni el propio desarrollo podria ver una sola pantalla.
  if (AUTH_BYPASS && !user) return <>{children}</>;

  if (!can(permission)) {
    return (
      <div className="py-10">
        <Alert variant="error">
          No tienes permiso para ver esta sección. Pídele a un administrador el acceso
          correspondiente y vuelve a entrar.
        </Alert>
      </div>
    );
  }

  return <>{children}</>;
}
