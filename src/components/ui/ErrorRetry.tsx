import type { ReactNode } from "react";
import { Alert } from "./Alert";
import { Button } from "./Button";

interface ErrorRetryProps {
  children: ReactNode;
  onRetry: () => void;
  className?: string;
}

/** Un fallo de carga con su salida al lado. Va fuera del panel: es un error de la consulta, no un dato. */
export function ErrorRetry({ children, onRetry, className = "" }: ErrorRetryProps) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <div className="min-w-[240px] flex-1">
        <Alert variant="error">{children}</Alert>
      </div>
      <Button size="sm" variant="secondary" onClick={onRetry}>
        Reintentar
      </Button>
    </div>
  );
}
