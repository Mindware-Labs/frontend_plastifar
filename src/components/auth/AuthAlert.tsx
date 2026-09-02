import { CircleAlert, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

interface AuthAlertProps {
  variant?: "error" | "success";
  children: ReactNode;
}

/**
 * Aviso de formulario. Mismo peso visual que un campo —1px de filete y un
 * fondo al 5 %— para que aparezca dentro de la columna sin romperla.
 */
export function AuthAlert({ variant = "error", children }: AuthAlertProps) {
  const isError = variant === "error";

  return (
    <div
      role={isError ? "alert" : "status"}
      className={`animate-plf-rise flex items-start gap-2.5 rounded-edge border px-[15px] py-3
        text-[13px] font-medium leading-relaxed ${
          isError
            ? "border-brand-red/20 bg-brand-red/[0.05] text-brand-red-dark"
            : "border-brand-green/20 bg-brand-green/[0.05] text-brand-green"
        }`}
    >
      {isError ? (
        <CircleAlert className="mt-px h-4 w-4 shrink-0" aria-hidden />
      ) : (
        <ShieldCheck className="mt-px h-4 w-4 shrink-0" aria-hidden />
      )}
      <span>{children}</span>
    </div>
  );
}
