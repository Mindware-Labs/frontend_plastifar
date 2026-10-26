import { X } from "lucide-react";

/** Botón compacto de barra de herramientas para limpiar búsqueda y filtros activos. */
export function ClearFiltersButton({
  onClick,
  title = "Limpiar filtros",
}: {
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 text-[12.5px] font-medium text-zinc-600 shadow-2xs hover:bg-zinc-50 hover:border-zinc-300 transition-all cursor-pointer active:scale-[0.98]"
    >
      <X className="h-3.5 w-3.5 text-zinc-400" />
      <span>Limpiar</span>
    </button>
  );
}
