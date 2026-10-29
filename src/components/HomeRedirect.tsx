import { Navigate } from "react-router-dom";
import { usePermissions } from "../hooks/usePermissions";

/** Entrada según lo que la persona puede abrir; VIEW ONLY no debe caer en /bandeja. */
export function HomeRedirect() {
  const { can } = usePermissions();

  if (can("mail.read")) return <Navigate to="/bandeja" replace />;
  if (can("tickets.read")) return <Navigate to="/tickets" replace />;
  return <Navigate to="/dashboard" replace />;
}
