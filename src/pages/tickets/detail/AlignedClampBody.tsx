import { ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Cuerpo de tarjeta cuya altura se limita para que su borde inferior no pase
 * del borde inferior del elemento `alignToId` (cuando están en columnas paralelas).
 * Si el contenido no excede ese límite se muestra completo; si lo excede, se recorta
 * con un aviso para hacer clic y ver el mensaje completo (`onExpand`).
 */
export function AlignedClampBody({
  alignToId,
  onExpand,
  children,
}: {
  alignToId: string;
  onExpand: () => void;
  children: React.ReactNode;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState<number | null>(null);

  useEffect(() => {
    const body = bodyRef.current;
    const inner = innerRef.current;
    const target = document.getElementById(alignToId);
    if (!body || !inner || !target) return;
    const mq = window.matchMedia("(min-width: 1024px)");

    const measure = () => {
      if (!mq.matches) {
        setMaxHeight(null);
        return;
      }
      // -1: el borde inferior (1px) de la tarjeta contenedora queda fuera del cuerpo.
      const available = Math.round(target.getBoundingClientRect().bottom - body.getBoundingClientRect().top - 1);
      const needed = inner.offsetHeight;
      setMaxHeight(available > 80 && needed > available ? available : null);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(inner);
    ro.observe(target);
    // Cualquier ancestro (hasta el que contiene al objetivo) puede mover la posición
    // vertical del cuerpo o del objetivo sin cambiar su tamaño: observarlos todos.
    for (let el: HTMLElement | null = body.parentElement; el && !el.contains(target); el = el.parentElement) {
      ro.observe(el);
    }
    for (let el: HTMLElement | null = target.parentElement; el && !el.contains(body); el = el.parentElement) {
      ro.observe(el);
    }
    ro.observe(document.body);
    window.addEventListener("resize", measure);
    void document.fonts?.ready.then(measure);
    mq.addEventListener("change", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      mq.removeEventListener("change", measure);
    };
  }, [alignToId]);

  const clamped = maxHeight !== null;

  return (
    <div
      ref={bodyRef}
      style={clamped ? { maxHeight } : undefined}
      className={clamped ? "relative overflow-hidden" : "relative"}
    >
      <div ref={innerRef} className="p-4">
        {children}
      </div>
      {clamped && (
        <button
          type="button"
          onClick={onExpand}
          className="absolute inset-x-0 bottom-0 flex h-20 cursor-pointer items-end justify-center bg-gradient-to-t from-white via-white/95 to-transparent pb-3 outline-none focus-visible:ring-2 focus-visible:ring-brand-red/25"
        >
          <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-[11.5px] font-medium text-zinc-600 shadow-2xs transition-colors hover:border-zinc-300 hover:text-zinc-900">
            Haz clic para ver el mensaje completo
            <ArrowRight className="size-3" />
          </span>
        </button>
      )}
    </div>
  );
}
