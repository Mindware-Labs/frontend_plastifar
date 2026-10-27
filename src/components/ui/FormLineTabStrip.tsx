import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface FormLineTabStripProps {
  /** Índice de la pestaña activa; se usa para hacer scroll hasta ella. */
  activeIndex: number;
  /** Cambia cuando se agregan o quitan pestañas (ResizeObserver + scroll). */
  tabCount: number;
  className?: string;
  /** Acción fija a la derecha (p. ej. «Agregar línea»), siempre visible. */
  trailing?: ReactNode;
  children: ReactNode;
}

/**
 * Barra horizontal de pestañas «tipo navegador» para formularios con varias líneas.
 * Scroll suave, gradientes y flechas cuando hay overflow; el `trailing` no se desplaza.
 */
export function FormLineTabStrip({
  activeIndex,
  tabCount,
  className = "",
  trailing,
  children,
}: FormLineTabStripProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollHints = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const overflow = scrollWidth > clientWidth + 2;
    setCanScrollLeft(overflow && scrollLeft > 2);
    setCanScrollRight(overflow && scrollLeft < scrollWidth - clientWidth - 2);
  }, []);

  useEffect(() => {
    updateScrollHints();
    const el = scrollerRef.current;
    const content = contentRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollHints, { passive: true });
    const ro = new ResizeObserver(updateScrollHints);
    ro.observe(el);
    if (content) ro.observe(content);
    return () => {
      el.removeEventListener("scroll", updateScrollHints);
      ro.disconnect();
    };
  }, [updateScrollHints, tabCount]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const tab = el.querySelector<HTMLElement>(`[data-line-tab-index="${activeIndex}"]`);
    tab?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [activeIndex, tabCount]);

  const scrollBy = (delta: number) => {
    scrollerRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <div className={`flex min-w-0 items-center gap-2 ${className}`.trim()}>
      <div className="relative min-w-0 flex-1">
        {canScrollLeft && (
          <>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-10 bg-gradient-to-r from-white from-30% via-white/90 to-transparent"
            />
            <button
              type="button"
              aria-label="Desplazar pestañas hacia la izquierda"
              onClick={() => scrollBy(-180)}
              className="absolute left-0 top-1/2 z-[2] flex size-7 -translate-y-1/2 items-center justify-center rounded-lg border border-zinc-200/90 bg-white/95 text-zinc-600 shadow-2xs backdrop-blur-sm transition-colors hover:border-zinc-300 hover:text-zinc-900 cursor-pointer"
            >
              <ChevronLeft className="size-4" />
            </button>
          </>
        )}
        {canScrollRight && (
          <>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-10 bg-gradient-to-l from-white from-30% via-white/90 to-transparent"
            />
            <button
              type="button"
              aria-label="Desplazar pestañas hacia la derecha"
              onClick={() => scrollBy(180)}
              className="absolute right-0 top-1/2 z-[2] flex size-7 -translate-y-1/2 items-center justify-center rounded-lg border border-zinc-200/90 bg-white/95 text-zinc-600 shadow-2xs backdrop-blur-sm transition-colors hover:border-zinc-300 hover:text-zinc-900 cursor-pointer"
            >
              <ChevronRight className="size-4" />
            </button>
          </>
        )}
        <div
          ref={scrollerRef}
          className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain py-0.5 pr-0.5 scroll-smooth no-scrollbar"
        >
          <div ref={contentRef} className="flex w-max min-w-full items-center gap-1.5">
            {children}
          </div>
        </div>
      </div>
      {trailing !== undefined && trailing !== null ? (
        <div className="shrink-0">{trailing}</div>
      ) : null}
    </div>
  );
}

/** Atributo estándar para que la barra pueda hacer scroll hasta la pestaña activa. */
export const formLineTabIndexAttr = (index: number) => ({
  "data-line-tab-index": index,
});
