import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { prefersReducedMotion } from "../../hooks/motion";

interface AppleSlidePanelProps {
  /** Identidad estable (p. ej. field.id) — no re-dispara la animación en cada render del formulario. */
  motionKey: string;
  /** Montaje o línea activa nueva: entrada lateral. */
  enter?: boolean;
  /** Salida lateral antes de desmontar del formulario. */
  exit?: boolean;
  className?: string;
  innerClassName?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/** Entrada/salida lateral sin colapso de alto; el primer fotograma usa prep + rAF para evitar parpadeos. */
export function AppleSlidePanel({
  motionKey,
  enter = false,
  exit = false,
  className = "",
  innerClassName = "",
  style,
  children,
}: AppleSlidePanelProps) {
  const [motionClass, setMotionClass] = useState("");
  const enterCycle = useRef(0);

  useLayoutEffect(() => {
    if (exit) {
      enterCycle.current += 1;
      setMotionClass(
        prefersReducedMotion() ? "" : "animate-plf-apple-line-slide-out",
      );
      return;
    }

    if (!enter || prefersReducedMotion()) {
      enterCycle.current += 1;
      setMotionClass(exit ? "" : "plf-slide-enter-done");
      return;
    }

    const cycle = ++enterCycle.current;
    setMotionClass("plf-slide-enter-prep");

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (enterCycle.current !== cycle) return;
        setMotionClass("animate-plf-apple-line-slide-in");
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [motionKey, enter, exit]);

  return (
    <div className={`overflow-hidden ${className}`.trim()} style={style}>
      <div className={`${innerClassName} ${motionClass}`.trim()}>{children}</div>
    </div>
  );
}

export function appleLineTabMotionClass(isEntering: boolean, exiting: boolean): string {
  if (exiting) return "pointer-events-none animate-plf-apple-line-tab-out";
  if (isEntering) return "animate-plf-apple-line-tab-in";
  return "";
}
