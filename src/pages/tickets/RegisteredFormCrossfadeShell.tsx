import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { prefersReducedMotion } from "../../hooks/motion";
import type { RegisteredFormItem } from "./TicketFormsTab";

interface RegisteredFormCrossfadeShellProps {
  activeKey: string;
  direction: "forward" | "backward";
  enabled: boolean;
  forms: RegisteredFormItem[];
  children: (form: RegisteredFormItem) => ReactNode;
}

const TAB_ANIMATION_MS = 220;

/**
 * Contenedor de formularios registrados con animación de entrada limpia y elegante.
 * Al cambiar de pestaña, el nuevo formulario entra de inmediato con una suave animación
 * de entrada, evitando que las letras y textos se sobrepongan entre capas transparentes.
 * Además, la altura del contenedor se adapta suavemente para evitar saltos en la UI.
 */
export function RegisteredFormCrossfadeShell({
  activeKey,
  direction,
  enabled,
  forms,
  children,
}: RegisteredFormCrossfadeShellProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState<number | undefined>(undefined);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const prevKeyRef = useRef(activeKey);

  const activeForm = forms.find((item) => item.key === activeKey) ?? forms[0];

  useLayoutEffect(() => {
    if (!enabled || prefersReducedMotion()) {
      prevKeyRef.current = activeKey;
      setContainerHeight(undefined);
      setIsTransitioning(false);
      return;
    }

    if (prevKeyRef.current === activeKey) return;
    prevKeyRef.current = activeKey;

    // Medir la altura previa antes del cambio
    const prevHeight = containerRef.current?.offsetHeight;
    if (prevHeight) {
      setContainerHeight(prevHeight);
    }
    setIsTransitioning(true);

    // En el frame siguiente medimos la altura entrante y animamos hacia ella
    const frame = requestAnimationFrame(() => {
      if (contentRef.current) {
        setContainerHeight(contentRef.current.offsetHeight);
      }
    });

    const timer = window.setTimeout(() => {
      setIsTransitioning(false);
      setContainerHeight(undefined);
    }, TAB_ANIMATION_MS);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [activeKey, enabled]);

  if (!activeForm) return null;

  const animationClass = enabled
    ? direction === "forward"
      ? "animate-plf-form-in-forward motion-reduce:animate-none"
      : "animate-plf-form-in-backward motion-reduce:animate-none"
    : "";

  return (
    <div
      ref={containerRef}
      className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xs relative"
      style={{
        height: containerHeight !== undefined ? `${containerHeight}px` : "auto",
        transition: isTransitioning
          ? `height ${TAB_ANIMATION_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`
          : undefined,
        willChange: isTransitioning ? "height" : undefined,
      }}
    >
      <div
        key={activeKey}
        ref={contentRef}
        className={`p-5 w-full ${animationClass}`}
      >
        {children(activeForm)}
      </div>
    </div>
  );
}
