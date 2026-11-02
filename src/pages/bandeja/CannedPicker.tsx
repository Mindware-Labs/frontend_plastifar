import { MessageSquareText, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDisclosureMotion } from "../../hooks/useDisclosureMotion";
import { cannedApi } from "../../api/canned";
import type { CannedResponseResponse } from "../../types/api";
import { getCategoryBadgeClasses, parseCanned } from "../respuestas/cannedHelpers";

interface CannedPickerProps {
  /** Texto elegido y asunto sugerido opcional: quien lo recibe lo inserta en el editor. */
  onPick: (body: string, suggestedSubject?: string) => void;
}

/** Botón "Respuestas rápidas" del editor: abre una lista con filtro por texto y categoría. */
export function CannedPicker({ onPick }: CannedPickerProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CannedResponseResponse[] | null>(null);
  const [filter, setFilter] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [originX, setOriginX] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { mounted, exiting, ref: popoverRef } = useDisclosureMotion<HTMLDivElement>(open, { direction: "up" });

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

  // Parsear items para búsqueda y badges
  const parsedItems = useMemo(() => {
    return (items ?? []).map((item) => {
      const parsed = parseCanned(item.title, item.body, item.categoryName);
      return {
        item,
        ...parsed,
      };
    });
  }, [items]);

  // Extraer categorías existentes
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    parsedItems.forEach((p) => {
      if (p.category && p.category.toLowerCase() !== "general") cats.add(p.category);
    });
    return Array.from(cats);
  }, [parsedItems]);

  const term = filter.trim().toLowerCase();
  const visible = useMemo(() => {
    return parsedItems.filter((p) => {
      if (selectedCategory !== "all" && p.category.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }
      if (!term) return true;
      return (
        p.cleanTitle.toLowerCase().includes(term) ||
        p.cleanBody.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term) ||
        (p.suggestedSubject && p.suggestedSubject.toLowerCase().includes(term))
      );
    });
  }, [parsedItems, selectedCategory, term]);

  return (
    <div ref={panelRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setOriginX((triggerRef.current?.offsetWidth ?? 0) / 2);
          setOpen((current) => !current);
        }}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white
          px-2.5 text-[12px] font-medium text-zinc-700 shadow-2xs outline-none
          transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900
          active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-zinc-400/20 cursor-pointer"
      >
        <MessageSquareText className="h-3.5 w-3.5 text-zinc-500" />
        Respuestas rápidas
      </button>

      {mounted && (
        <div
          ref={popoverRef}
          aria-hidden={exiting}
          style={{ transformOrigin: `${originX}px bottom` }}
          className={`absolute bottom-full left-0 z-40 mb-2 flex w-[380px] flex-col rounded-xl border border-zinc-200/90
            bg-white shadow-[0_10px_28px_-6px_rgba(0,0,0,0.12),0_2px_8px_-2px_rgba(0,0,0,0.04)] ${exiting ? "pointer-events-none" : ""}`}
        >
          {/* Barra de búsqueda */}
          <div data-motion-item className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2 bg-zinc-50/70">
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Buscar plantilla o categoría…"
              autoFocus
              className="min-w-0 flex-1 bg-transparent text-[12px] text-zinc-900 outline-none placeholder:text-zinc-400 font-medium"
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

          {/* Chips de filtro rápido por categoría si hay más de una */}
          {availableCategories.length > 0 && (
            <div className="flex items-center gap-1 overflow-x-auto border-b border-zinc-100 bg-zinc-50/40 px-2.5 py-1.5 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedCategory("all")}
                className={`rounded-md px-2 py-0.5 text-[10.5px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCategory === "all"
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                }`}
              >
                Todas
              </button>
              {availableCategories.map((cat) => {
                const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(isSelected ? "all" : cat)}
                    className={`rounded-md px-2 py-0.5 text-[10.5px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-brand-red text-white font-semibold"
                        : "text-zinc-600 bg-zinc-100 hover:bg-zinc-200/70"
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          )}

          {/* Lista de plantillas */}
          <div className="max-h-72 overflow-y-auto p-1.5 space-y-0.5">
            {items === null ? (
              <p className="px-3 py-4 text-center text-[12px] text-zinc-400">Cargando plantillas…</p>
            ) : visible.length === 0 ? (
              <p className="px-3 py-5 text-center text-[12px] text-zinc-400">
                {items.length === 0
                  ? "Todavía no hay respuestas guardadas. Se crean en Correo › Respuestas."
                  : "Ninguna plantilla coincide con la búsqueda."}
              </p>
            ) : (
              visible.map((entry) => {
                const badge = getCategoryBadgeClasses(entry.category);
                return (
                  <button
                    key={entry.item.id}
                    data-motion-item
                    type="button"
                    onClick={() => {
                      onPick(entry.cleanBody, entry.suggestedSubject);
                      setOpen(false);
                    }}
                    className="flex w-full flex-col items-start rounded-lg px-2.5 py-2 text-left outline-none
                      transition-colors hover:bg-zinc-50 focus-visible:bg-zinc-50 cursor-pointer group border border-transparent hover:border-zinc-200/80"
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="text-[12px] font-semibold text-zinc-900 truncate group-hover:text-brand-red transition-colors">
                        {entry.cleanTitle}
                      </span>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[9.5px] font-semibold ${badge.badge}`}
                      >
                        <span className={`size-1 rounded-full ${badge.dot}`} />
                        {entry.category}
                      </span>
                    </div>

                    {entry.suggestedSubject && (
                      <span className="text-[10.5px] text-zinc-400 italic truncate max-w-full">
                        Asunto: {entry.suggestedSubject}
                      </span>
                    )}

                    <span className="line-clamp-2 text-[11px] text-zinc-500 leading-snug mt-0.5">
                      {entry.cleanBody}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
