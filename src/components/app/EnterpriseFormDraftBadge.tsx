import { cn } from "../../lib/utils";

interface EnterpriseFormDraftBadgeProps {
  className?: string;
  /** Etiqueta corta en catálogo; la landing puede usar variante más explícita. */
  variant?: "catalog" | "emphasis";
}

export function EnterpriseFormDraftBadge({
  className,
  variant = "catalog",
}: EnterpriseFormDraftBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border font-semibold text-brand-red",
        variant === "catalog"
          ? "border-brand-red/20 bg-brand-red/10 px-2 py-0.5 text-[10px]"
          : "border-brand-red/20 bg-white/80 px-2 py-0.5 text-[10px] ring-1 ring-zinc-200/80",
        className,
      )}
    >
      {variant === "emphasis" ? "Borrador local" : "Borrador"}
    </span>
  );
}
