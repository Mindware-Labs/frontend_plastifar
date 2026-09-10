import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import type { ReactNode } from "react";

interface AlertProps {
  variant: "error" | "success" | "info";
  children: ReactNode;
  className?: string;
}

const variants = {
  error: {
    icon: AlertCircle,
    role: "alert",
    containerClass: "border-brand-red/25 bg-brand-red/[0.04] text-brand-red-dark",
    iconClass: "text-brand-red",
  },
  success: {
    icon: CheckCircle2,
    role: "status",
    containerClass: "border-brand-green/25 bg-brand-green/[0.05] text-brand-green",
    iconClass: "text-brand-green",
  },
  info: {
    icon: Info,
    role: "note",
    containerClass: "border-sky-500/20 bg-sky-50/70 text-sky-950",
    iconClass: "text-sky-600",
  },
} as const;

export function Alert({ variant, children, className = "" }: AlertProps) {
  const { icon: Icon, role, containerClass, iconClass } = variants[variant];

  return (
    <div
      role={role}
      className={`flex items-start gap-2.5 overflow-hidden rounded-edge border
        px-3.5 py-2.5 text-[12.5px] font-medium leading-relaxed ${containerClass} ${className}`}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconClass}`} />
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}
