import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import type { ReactNode } from "react";

interface AlertProps {
  variant: "error" | "success" | "info";
  children: ReactNode;
}

const variants = {
  error: {
    icon: AlertCircle,
    role: "alert",
    className: "border-brand-red/25 bg-brand-red/[0.04] text-brand-red-dark",
  },
  success: {
    icon: CheckCircle2,
    role: "status",
    className: "border-brand-green/25 bg-brand-green/[0.05] text-brand-green",
  },
  info: {
    icon: Info,
    role: "note",
    className: "border-line-strong bg-canvas text-brand-gray",
  },
} as const;

export function Alert({ variant, children }: AlertProps) {
  const { icon: Icon, role, className } = variants[variant];

  return (
    <div
      role={role}
      className={`flex items-start gap-2.5 overflow-hidden rounded-edge border
        px-3.5 py-2.5 text-[12.5px] font-medium leading-relaxed ${className}`}
    >
      <Icon className="mt-px h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
