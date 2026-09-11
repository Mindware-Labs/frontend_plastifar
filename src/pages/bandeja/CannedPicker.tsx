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
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white
          px-2.5 text-[12px] font-medium text-zinc-700 shadow-2xs outline-none
          transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900
          active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-zinc-400/20 cursor-pointer"
      >
        <MessageSquareText className="h-3.5 w-3.5 text-zinc-500" />
        Respuestas rápidas
      </button>

      {open && (
        <div
          className="animate-plf-popover-in absolute bottom-full left-0 z-40 mb-2 flex w-[340px] flex-col rounded-lg border border-zinc-200/90
            bg-white shadow-[0_10px_28px_-6px_rgba(0,0,0,0.12),0_2px_8px_-2px_rgba(0,0,0,0.04)]"
        >
          <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2 bg-zinc-50/50">
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Buscar una respuesta…"
              autoFocus
              className="min-w-0 flex-1 bg-transparent text-[12px] text-zinc-900 outline-none placeholder:text-zinc-400"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              className="flex h-5 w-5 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto p-1">
            {items === null ? (
              <p className="px-3 py-3 text-[12px] text-zinc-400">Cargando…</p>
            ) : visible.length === 0 ? (
              <p className="px-3 py-3 text-[12px] text-zinc-400">
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
                  className="flex w-full flex-col items-start rounded-md px-2.5 py-1.5 text-left outline-none
                    transition-colors hover:bg-zinc-50 focus-visible:bg-zinc-50 cursor-pointer"
                >
                  <span className="text-[12px] font-semibold text-zinc-900">{item.title}</span>
                  <span className="line-clamp-2 text-[11px] text-zinc-500 leading-snug">{item.body}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
