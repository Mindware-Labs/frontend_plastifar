import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";

interface AlertProps {
  variant: "error" | "success";
  children: ReactNode;
}

const variants = {
  error: {
    icon: AlertCircle,
    className: "border-brand-red/25 bg-brand-red/[0.04] text-brand-red-dark",
    accent: "bg-brand-red",
  },
  success: {
    icon: CheckCircle2,
    className: "border-brand-green/25 bg-brand-green/[0.05] text-brand-green",
    accent: "bg-brand-green",
  },
} as const;

export function Alert({ variant, children }: AlertProps) {
  const { icon: Icon, className, accent } = variants[variant];

  return (
    <div
      role="alert"
      className={`relative flex items-start gap-2.5 overflow-hidden rounded-edge border
        py-2.5 pl-4 pr-3.5 text-[12.5px] font-medium leading-relaxed ${className}`}
    >
      <span aria-hidden className={`absolute inset-y-0 left-0 w-[3px] ${accent}`} />
      <Icon className="mt-px h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
