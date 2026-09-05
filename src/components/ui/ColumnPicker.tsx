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
        className={`inline-flex h-8 items-center gap-[7px] rounded-edge border px-3 text-[12.5px] font-medium
          transition-colors outline-none focus-visible:ring-3 focus-visible:ring-brand-red/20 ${
            hiddenCount > 0
              ? "border-line-strong bg-canvas text-ink"
              : "border-line bg-white text-brand-gray hover:border-line-strong hover:text-ink"
          }`}
      >
        <Columns3 aria-hidden className="h-4 w-4 text-faint" />
        {label}
        {hiddenCount > 0 && (
          <span className="rounded-full bg-fill px-1.5 py-px text-[11px] font-semibold text-muted">
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
            className="animate-plf-toast-in z-[60] w-[248px] overflow-y-auto rounded-edge border border-line bg-white p-1
              shadow-panel"
          >
            <p className="px-2.5 pb-1.5 pt-2 font-heading text-[10px] font-semibold uppercase tracking-[0.08em] text-faint">
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
                    className="flex w-full items-center justify-between gap-2 rounded-edge px-2.5 py-2 text-left
                      text-[13px] text-brand-gray outline-none transition-colors
                      hover:bg-fill hover:text-ink focus-visible:bg-fill focus-visible:text-ink
                      disabled:cursor-not-allowed disabled:text-faint disabled:hover:bg-transparent"
                  >
                    <span className="truncate">{column.label}</span>
                    {isVisible && <Check aria-hidden className="h-4 w-4 shrink-0 text-brand-red" />}
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
