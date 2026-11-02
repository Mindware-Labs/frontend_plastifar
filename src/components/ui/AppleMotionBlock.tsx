import type { CSSProperties, ReactNode } from "react";
import type { AppleListPhase } from "../../hooks/useAppleListMotion";

type AppleMotionRowPreset = "spreadsheet" | "composer";

const ROW_PRESET_CLASS: Record<
  AppleMotionRowPreset,
  { shell: string; in: string; out: string }
> = {
  spreadsheet: {
    shell: "plf-apple-row-shell",
    in: "animate-plf-apple-row-in",
    out: "animate-plf-apple-row-out",
  },
  composer: {
    shell: "plf-composer-row-shell",
    in: "animate-plf-composer-row-in",
    out: "animate-plf-composer-row-out",
  },
};

interface AppleMotionBlockProps {
  phase: AppleListPhase;
  rowPreset?: AppleMotionRowPreset;
  className?: string;
  innerClassName?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/** Bloque con la misma entrada/salida elástica que las filas PF-FOR-068 (grid 0fr → 1fr). */
export function AppleMotionBlock({
  phase,
  rowPreset = "spreadsheet",
  className = "",
  innerClassName = "",
  style,
  children,
}: AppleMotionBlockProps) {
  const preset = ROW_PRESET_CLASS[rowPreset];
  const collapsed = phase === "from" || phase === "hold" || phase === "out";
  const ready = phase === "hold" || phase === "in" || phase === "arm" || phase === "out";
  const motion = phase === "out" || phase === "arm" ? "out" : phase === "idle" ? "idle" : "in";

  return (
    <div className={className} style={style}>
      <div
        className={preset.shell}
        data-collapsed={collapsed ? "true" : "false"}
        data-ready={ready ? "true" : "false"}
        data-motion={motion}
      >
        <div className="plf-apple-row-clip">
          <div
            className={`${innerClassName} ${
              phase === "in"
                ? preset.in
                : phase === "out"
                  ? preset.out
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
