import { ChevronDown, FileDown, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDisclosureMotion } from "../../hooks/useDisclosureMotion";
import { Button } from "../ui/Button";

export interface DocumentDropdownProps {
  onExportExcel: () => void | Promise<void>;
  onExportPdf: () => void;
  onPrint: () => void;
  label?: string;
  size?: "sm" | "md";
  variant?: "primary" | "secondary";
  align?: "left" | "right";
  className?: string;
}

/**
 * Botón unificado de opciones de documento que engloba:
 * 1. Exportar doc Excel (.xlsx con formato oficial)
 * 2. Guardar doc PDF (generación y descarga directa)
 * 3. Imprimir (diálogo de impresión nativo)
 */
export function DocumentDropdown({
  onExportExcel,
  onExportPdf,
  onPrint,
  label = "Documento",
  size = "sm",
  variant = "secondary",
  align = "right",
  className = "",
}: DocumentDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { mounted, exiting, ref: panelRef } = useDisclosureMotion<HTMLDivElement>(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        containerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, panelRef]);

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      <Button
        size={size}
        variant={variant}
        onClick={() => setIsOpen((prev) => !prev)}
        className="gap-1.5"
        title="Opciones de documento (Excel, PDF, Imprimir)"
      >
        <FileDown className="size-3.5 text-zinc-600" />
        <span>{label}</span>
        <ChevronDown
          className={`size-3 text-zinc-400 transition-transform duration-280 ease-plf-spring motion-reduce:transition-none ${
            isOpen ? "rotate-180 text-zinc-700" : "group-hover:text-zinc-600"
          }`}
        />
      </Button>

      {mounted && (
        <div
          ref={panelRef}
          style={exiting ? { pointerEvents: "none" } : undefined}
          aria-hidden={exiting}
          className={`absolute ${align === "right" ? "right-0" : "left-0"} top-full mt-1.5 w-52 rounded-xl border border-zinc-200/90 bg-white/95 backdrop-blur-xs py-1 shadow-lg z-30`}
        >
          {/* Opción 1: Exportar doc Excel */}
          <button
            type="button"
            data-motion-item
            onClick={() => {
              setIsOpen(false);
              void onExportExcel();
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition-colors cursor-pointer text-left"
          >
            <FileSpreadsheet className="size-3.5 text-emerald-600 shrink-0" />
            <span>Exportar doc Excel</span>
          </button>

          {/* Opción 2: Guardar doc PDF */}
          <button
            type="button"
            data-motion-item
            onClick={() => {
              setIsOpen(false);
              onExportPdf();
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition-colors cursor-pointer text-left"
          >
            <FileText className="size-3.5 text-rose-600 shrink-0" />
            <span>Guardar doc PDF</span>
          </button>

          {/* Opción 3: Imprimir */}
          <button
            type="button"
            data-motion-item
            onClick={() => {
              setIsOpen(false);
              onPrint();
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition-colors cursor-pointer text-left"
          >
            <Printer className="size-3.5 text-zinc-600 shrink-0" />
            <span>Imprimir</span>
          </button>
        </div>
      )}
    </div>
  );
}
