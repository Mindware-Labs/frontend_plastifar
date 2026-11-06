import type { ReactNode } from "react";
import { Alert } from "../ui/Alert";

interface AuthAlertProps {
  variant?: "error" | "success";
  children: ReactNode;
}

/** Aviso inline en pantallas de acceso; usa el mismo Alert que el panel. */
export function AuthAlert({ variant = "error", children }: AuthAlertProps) {
  return <Alert variant={variant}>{children}</Alert>;
}
