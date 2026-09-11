import { MessageSquareText, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cannedApi } from "../../api/canned";
import type { CannedResponseResponse } from "../../types/api";

interface CannedPickerProps {
  /** Texto elegido: quien lo recibe lo mete en el editor. */
  onPick: (body: string) => void;
}

/** Convierte texto plano en bloques del editor: un parrafo por linea en blanco. */
export function textToBlocks(text: string): unknown[] {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => ({
      type: "paragraph",
      content: paragraph.split("\n").flatMap((line, index) =>
        index === 0 ? [{ type: "text", text: line, styles: {} }] : [{ type: "text", text: `\n${line}`, styles: {} }],
      ),
    }));
}

/** Boton "Respuestas rápidas" del editor: abre una lista con filtro y mete el texto elegido. */
export function CannedPicker({ onPick }: CannedPickerProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CannedResponseResponse[] | null>(null);
  const [filter, setFilter] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || items !== null) return;
    cannedApi
      .list()
      .then(setItems)
      .catch(() => setItems([]));
  }, [open, items]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const term = filter.trim().toLowerCase();
  const visible = (items ?? []).filter(
    (item) => !term || item.title.toLowerCase().includes(term) || item.body.toLowerCase().includes(term),
  );

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center gap-1.5 rounded-edge border border-line bg-canvas
          px-2 py-1 text-[11.5px] font-medium text-brand-gray outline-none
          transition-[background-color,border-color,color]
          hover:border-line-strong hover:bg-white hover:text-ink
          focus-visible:ring-3 focus-visible:ring-brand-red/20"
      >
        <MessageSquareText className="h-3.5 w-3.5" />
        Respuestas rápidas
      </button>

      {open && (
        <div
          className="absolute bottom-full left-0 z-40 mb-1.5 flex w-[340px] flex-col rounded-edge border border-line
            bg-white shadow-[0_8px_24px_-4px_rgba(27,27,29,0.14)]"
        >
          <div className="flex items-center gap-2 border-b border-line px-3 py-2">
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Buscar una respuesta…"
              autoFocus
              className="min-w-0 flex-1 bg-transparent text-[12px] text-ink outline-none placeholder:text-faint"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              className="flex h-5 w-5 items-center justify-center rounded-edge text-faint hover:bg-fill hover:text-ink"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            {items === null ? (
              <p className="px-3 py-3 text-[12px] text-subtle">Cargando…</p>
            ) : visible.length === 0 ? (
              <p className="px-3 py-3 text-[12px] text-subtle">
                {items.length === 0
                  ? "Todavía no hay respuestas guardadas. Se crean en Correo › Respuestas."
                  : "Ninguna coincide con la búsqueda."}
              </p>
            ) : (
              visible.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onPick(item.body);
                    setOpen(false);
                  }}
                  className="flex w-full flex-col items-start px-3 py-1.5 text-left outline-none
                    hover:bg-brand-red/[0.05] focus-visible:bg-brand-red/[0.05]"
                >
                  <span className="text-[12px] font-semibold text-ink">{item.title}</span>
                  <span className="line-clamp-2 text-[11px] text-subtle">{item.body}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
