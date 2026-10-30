import type { CSSProperties, ReactNode } from "react";
import type { AppleListPhase } from "../../hooks/useAppleListMotion";

interface AppleMotionBlockProps {
  phase: AppleListPhase;
  className?: string;
  innerClassName?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/** Bloque con la misma entrada/salida elástica que las filas PF-FOR-068 (grid 0fr → 1fr). */
export function AppleMotionBlock({
  phase,
  className = "",
  innerClassName = "",
  style,
  children,
}: AppleMotionBlockProps) {
  const collapsed = phase === "from" || phase === "hold" || phase === "out";
  const ready = phase === "hold" || phase === "in" || phase === "arm" || phase === "out";
  const motion = phase === "out" || phase === "arm" ? "out" : phase === "idle" ? "idle" : "in";

  return (
    <div className={className} style={style}>
      <div
        className="plf-apple-row-shell"
        data-collapsed={collapsed ? "true" : "false"}
        data-ready={ready ? "true" : "false"}
        data-motion={motion}
      >
        <div className="plf-apple-row-clip">
          <div
            className={`${innerClassName} ${
              phase === "in"
                ? "animate-plf-apple-row-in"
                : phase === "out"
                  ? "animate-plf-apple-row-out"
                  : phase === "from" || phase === "hold"
                    ? "opacity-0"
                    : ""
            }`}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
