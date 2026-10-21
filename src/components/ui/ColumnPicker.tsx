import { Columns3, Check } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface ColumnOption {
  id: string;
  label: string;
  /** Columna que no se puede ocultar: la tabla dejaria de leerse sin ella. */
  locked?: boolean;
}

interface ColumnPickerProps {
  columns: ColumnOption[];
  /** Ids visibles hoy. Las bloqueadas se dan por visibles siempre. */
  visible: string[];
  onChange: (visible: string[]) => void;
  label?: string;
}

const PANEL_MAX_HEIGHT = 300;

/**
 * Selector de columnas visibles de una tabla ancha. Vive en la fila de criterios,
 * a la derecha, separado de los filtros: no filtra filas, cambia lo que se mira.
 *
 * El panel va en un portal, igual que Select, para que no lo recorte el scroll
 * horizontal de la tabla que controla. Como el portal cuelga del final del
 * documento, el foco entra al abrir y vuelve al disparador al cerrar: sin eso,
 * el tabulador saltaria al final de la pagina.
 */
export function ColumnPicker({ columns, visible, onChange, label = "Columnas" }: ColumnPickerProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [anchor, setAnchor] = useState<{ right: number; top: number } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const hideable = columns.filter((column) => !column.locked);
  const hiddenCount = hideable.filter((column) => !visible.includes(column.id)).length;

  function openPanel() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAnchor({ right: window.innerWidth - rect.right, top: rect.bottom + 4 });
    setActiveIndex(columns.findIndex((column) => !column.locked));
    setOpen(true);
  }

  function closePanel(returnFocus = true) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  function toggle(columnId: string) {
    const next = visible.includes(columnId)
      ? visible.filter((value) => value !== columnId)
      : [...visible, columnId];

    // Ocultarlas todas dejaria una tabla de una sola columna: se conserva una.
    if (next.length === 0) return;
    onChange(next);
  }

  /** Salta a la siguiente opcion utilizable en la direccion dada. */
  function move(from: number, step: number) {
    for (let index = from + step; index >= 0 && index < columns.length; index += step) {
      if (!columns[index].locked) return index;
    }
    return from;
  }

  // El foco entra al panel al abrirlo y sigue a la opcion activa.
  useEffect(() => {
    if (!open) return;
    itemRefs.current[activeIndex]?.focus();
  }, [open, activeIndex]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }

    function close() {
      setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  function handleMenuKeyDown(event: React.KeyboardEvent, index: number) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex(move(index, 1));
        return;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex(move(index, -1));
        return;
      case "Home":
        event.preventDefault();
        setActiveIndex(move(-1, 1));
        return;
      case "End":
        event.preventDefault();
        setActiveIndex(move(columns.length, -1));
        return;
      case "Escape":
      case "Tab":
        event.preventDefault();
        // Sin esto el Escape sigue subiendo hasta el listener de documento de un
        // Modal y cierra el dialogo entero, no solo este panel.
        event.stopPropagation();
        closePanel();
        return;
      default:
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => (open ? closePanel() : openPanel())}
        onKeyDown={(event) => {
          if (open || !["ArrowDown", "Enter", " "].includes(event.key)) return;
          event.preventDefault();
          openPanel();
        }}
        className={`group inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] font-medium shadow-2xs
          transition-colors duration-150 outline-none cursor-pointer select-none focus-visible:ring-3 focus-visible:ring-brand-red/20 ${
            hiddenCount > 0 || open
              ? "border-zinc-300 bg-zinc-50/80 text-zinc-900"
              : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
          }`}
      >
        <Columns3 aria-hidden className="h-3.5 w-3.5 text-zinc-500 group-hover:text-zinc-800" />
        {label}
        {hiddenCount > 0 && (
          <span className="rounded-full bg-zinc-100 px-1.5 py-px text-[11px] font-semibold tabular-nums text-zinc-700">
            {hideable.length - hiddenCount}/{hideable.length}
          </span>
        )}
      </button>

      {open &&
        anchor &&
        createPortal(
          <div
            ref={panelRef}
            id={id}
            style={{ position: "fixed", right: anchor.right, top: anchor.top, maxHeight: PANEL_MAX_HEIGHT }}
            className="animate-plf-toast-in z-[60] w-[248px] overflow-y-auto rounded-lg border border-zinc-200/90 bg-white p-1
              shadow-[0_10px_28px_-6px_rgba(0,0,0,0.12),0_2px_8px_-2px_rgba(0,0,0,0.04)]"
          >
            <p className="px-2.5 pb-1.5 pt-1.5 text-[11px] font-medium text-zinc-400">
              Columnas visibles
            </p>

            <div role="menu" aria-label="Columnas visibles">
              {columns.map((column, index) => {
                const isVisible = column.locked || visible.includes(column.id);

                return (
                  <button
                    key={column.id}
                    ref={(node) => {
                      itemRefs.current[index] = node;
                    }}
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={isVisible}
                    tabIndex={index === activeIndex ? 0 : -1}
                    disabled={column.locked}
                    onKeyDown={(event) => handleMenuKeyDown(event, index)}
                    onClick={() => toggle(column.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left
                      text-[12.5px] font-medium text-zinc-700 outline-none transition-colors cursor-pointer
                      hover:bg-zinc-50 hover:text-zinc-900 focus-visible:bg-zinc-50 focus-visible:text-zinc-900
                      disabled:cursor-not-allowed disabled:text-zinc-400 disabled:hover:bg-transparent"
                  >
                    <span className="truncate">{column.label}</span>
                    {isVisible && <Check aria-hidden className="h-3.5 w-3.5 shrink-0 text-brand-red" />}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
