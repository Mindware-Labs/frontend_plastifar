import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  FORM_CROSSFADE_DURATION_MS,
  formCrossfadeLayerClass,
  useFormCrossfadeStack,
} from "../../hooks/useFormCrossfadeStack";
import { prefersReducedMotion } from "../../hooks/motion";
import type { RegisteredFormItem } from "./TicketFormsTab";

interface RegisteredFormCrossfadeShellProps {
  activeKey: string;
  direction: "forward" | "backward";
  enabled: boolean;
  forms: RegisteredFormItem[];
  children: (form: RegisteredFormItem) => ReactNode;
}

/**
 * Transición suave y elegante entre formularios registrados de un ticket.
 * La capa saliente flota absolutamente mientras se desvanece de forma rápida y limpia,
 * la capa entrante se despliega en el flujo natural y la altura del contenedor se
 * anima suavemente sin saltos, tirones ni parpadeos.
 */
export function RegisteredFormCrossfadeShell({
  activeKey,
  direction,
  enabled,
  forms,
  children,
}: RegisteredFormCrossfadeShellProps) {
  const layers = useFormCrossfadeStack(activeKey, enabled);
  const containerRef = useRef<HTMLDivElement>(null);
  const enterLayerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState<number | undefined>(undefined);
  const [isAnimating, setIsAnimating] = useState(false);

  useLayoutEffect(() => {
    if (!enabled || prefersReducedMotion()) {
      setContainerHeight(undefined);
      setIsAnimating(false);
      return;
    }

    if (layers.length > 1) {
      // Registrar la altura actual antes de animar
      const currentHeight = containerRef.current?.offsetHeight;
      if (currentHeight) {
        setContainerHeight(currentHeight);
      }
      setIsAnimating(true);

      // En el siguiente cuadro de animación, medimos la altura entrante para animar hacia ella
      const frame = requestAnimationFrame(() => {
        if (enterLayerRef.current) {
          const nextHeight = enterLayerRef.current.offsetHeight;
          setContainerHeight(nextHeight);
        }
      });

      const timer = window.setTimeout(() => {
        setIsAnimating(false);
        setContainerHeight(undefined);
      }, FORM_CROSSFADE_DURATION_MS);

      return () => {
        cancelAnimationFrame(frame);
        window.clearTimeout(timer);
      };
    } else {
      setIsAnimating(false);
      setContainerHeight(undefined);
    }
  }, [layers, enabled]);

  return (
    <div
      ref={containerRef}
      className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xs relative"
      style={{
        height: containerHeight !== undefined ? `${containerHeight}px` : "auto",
        transition: isAnimating
          ? `height ${FORM_CROSSFADE_DURATION_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`
          : undefined,
        willChange: isAnimating ? "height" : undefined,
      }}
    >
      <div className="relative w-full">
        {layers.map((layer) => {
          const form = forms.find((item) => item.key === layer.key);
          if (!form) return null;
          const isExit = layer.role === "exit";

          return (
            <div
              key={layer.key}
              ref={!isExit ? enterLayerRef : undefined}
              className={`p-5 w-full ${
                isExit
                  ? "absolute top-0 left-0 pointer-events-none z-0"
                  : "relative z-[1]"
              }`}
            >
              <div className={formCrossfadeLayerClass(layer.role, direction)}>
                {children(form)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
