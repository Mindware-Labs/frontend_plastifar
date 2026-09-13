import { useId } from "react";

export type SpinnerSize = "sm" | "md" | "lg" | "xl";
export type SpinnerVariant = "brand" | "ring";

export interface SpinnerProps {
  /**
   * Tamaño del spinner:
   * - 'sm': 20 px (anillo cinético compacto sin isotipo, ideal para botones y celdas)
   * - 'md': 40 px (predeterminado para paneles, vistas de detalle y carga de correos)
   * - 'lg': 56 px (para vistas destacadas y modales de previsualización)
   * - 'xl': 72 px (para splash de sesión y pantallas completas)
   */
  size?: SpinnerSize;
  /**
   * Variante visual:
   * - 'brand': Anillo orbital cinético en rojo Plastifar + isotipo oficial en el centro con pulso sutil.
   * - 'ring': Anillo cinético puro de precisión sin isotipo interior.
   * Si no se especifica, usa 'brand' para 'md', 'lg', 'xl', y 'ring' para 'sm'.
   */
  variant?: SpinnerVariant;
  /** Texto explicativo opcional bajo el spinner (ej: "Cargando conversación...") */
  label?: string;
  className?: string;
}

const sizeConfig: Record<
  SpinnerSize,
  {
    box: string;
    logoHeight: number;
    badgeSize: string;
    stroke: number;
  }
> = {
  sm: {
    box: "h-5 w-5",
    logoHeight: 0,
    badgeSize: "hidden",
    stroke: 3.2,
  },
  md: {
    box: "h-10 w-10",
    logoHeight: 18,
    badgeSize: "h-[26px] w-[26px]",
    stroke: 2.75,
  },
  lg: {
    box: "h-14 w-14",
    logoHeight: 25,
    badgeSize: "h-[36px] w-[36px]",
    stroke: 2.6,
  },
  xl: {
    box: "h-20 w-20",
    logoHeight: 36,
    badgeSize: "h-[52px] w-[52px]",
    stroke: 2.4,
  },
};

/**
 * Spinner cinético institucional de Plastifar.
 * Combina un arco orbital continuo con estiramiento elástico en rojo corporativo
 * (Pantone 185 C) y un núcleo central con el isotipo oficial en pulsación armónica.
 */
export function Spinner({
  size = "md",
  variant,
  label,
  className = "",
}: SpinnerProps) {
  const gradientId = useId();
  const cfg = sizeConfig[size] ?? sizeConfig.md;
  const isBrand = (variant ?? (size === "sm" ? "ring" : "brand")) === "brand" && cfg.logoHeight > 0;

  return (
    <div
      role="status"
      aria-label={label || "Cargando"}
      className={`inline-flex flex-col items-center justify-center gap-3 select-none ${className}`}
    >
      <div className={`relative ${cfg.box} shrink-0`}>
        {/* Anillo orbital SVG cinético */}
        <svg
          viewBox="0 0 48 48"
          fill="none"
          aria-hidden="true"
          className="h-full w-full animate-plf-spinner-rotate"
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#e4002b" stopOpacity="0.12" />
              <stop offset="55%" stopColor="#e4002b" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#e4002b" stopOpacity="1" />
            </linearGradient>
          </defs>

          {/* Pista circular de precisión en tono de línea neutral */}
          <circle
            cx="24"
            cy="24"
            r="19"
            stroke="currentColor"
            strokeWidth={cfg.stroke}
            className="text-line-strong/35"
          />

          {/* Arco activo con estiramiento elástico y gradiente corporativo */}
          <circle
            cx="24"
            cy="24"
            r="19"
            stroke={`url(#${gradientId})`}
            strokeWidth={cfg.stroke}
            strokeLinecap="round"
            className="animate-plf-spinner-dash"
          />
        </svg>

        {/* Núcleo central con Isotipo oficial Plastifar (fijo y pulsante) */}
        {isBrand && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className={`flex items-center justify-center rounded-full bg-white border border-line-soft/90 shadow-[0_1px_4px_rgba(27,27,29,0.08)] animate-plf-spinner-pulse ${cfg.badgeSize}`}
            >
              <img
                src="/brand/plastifar-isotipo.png"
                alt=""
                aria-hidden
                height={cfg.logoHeight}
                style={{ height: cfg.logoHeight }}
                draggable={false}
                className="w-auto select-none"
              />
            </div>
          </div>
        )}
      </div>

      {label ? (
        <span className="font-heading text-[11.5px] font-medium tracking-[0.03em] text-subtle">
          {label}
        </span>
      ) : (
        <span className="sr-only">Cargando...</span>
      )}
    </div>
  );
}
