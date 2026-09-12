import { CircleAlert, Info, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

interface AlertProps {
  variant: "error" | "success" | "info";
  children: ReactNode;
  className?: string;
}

const variants = {
  error: {
    icon: CircleAlert,
    role: "alert",
    containerClass: "border-red-200/80 bg-red-50/80 text-red-700",
    iconClass: "text-brand-red",
  },
  success: {
    icon: ShieldCheck,
    role: "status",
    containerClass: "border-emerald-200/80 bg-emerald-50/80 text-emerald-800",
    iconClass: "text-emerald-600",
  },
  info: {
    icon: Info,
    role: "note",
    containerClass: "border-sky-200/80 bg-sky-50/80 text-sky-800",
    iconClass: "text-sky-600",
  },
} as const;

export function Alert({ variant, children, className = "" }: AlertProps) {
  const { icon: Icon, role, containerClass, iconClass } = variants[variant];

  return (
    <div
      role={role}
      className={`flex items-start gap-2.5 rounded-lg border p-3 text-[12.5px] font-medium leading-relaxed animate-plf-rise ${containerClass} ${className}`}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconClass}`} aria-hidden />
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}
