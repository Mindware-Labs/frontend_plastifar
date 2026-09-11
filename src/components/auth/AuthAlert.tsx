import { CircleAlert, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

interface AuthAlertProps {
  variant?: "error" | "success";
  children: ReactNode;
}

export function AuthAlert({ variant = "error", children }: AuthAlertProps) {
  const isError = variant === "error";

  return (
    <div
      role={isError ? "alert" : "status"}
      className={`flex items-start gap-2.5 rounded-lg border p-3 text-[12.5px] font-medium leading-relaxed animate-plf-rise ${
        isError
          ? "border-red-200/80 bg-red-50/80 text-red-700"
          : "border-emerald-200/80 bg-emerald-50/80 text-emerald-800"
      }`}
    >
      {isError ? (
        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-brand-red" aria-hidden />
      ) : (
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
      )}
      <span className="flex-1">{children}</span>
    </div>
  );
}
