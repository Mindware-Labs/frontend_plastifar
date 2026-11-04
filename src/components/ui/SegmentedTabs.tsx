import { useRef, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useModuleHeaderSectionIndicator } from "../../hooks/useModuleHeaderSectionIndicator";

/** Contador en pestañas del header (Actuales, Plantillas, etc.). */
export const SEGMENTED_TAB_COUNT_BADGE_CLASS =
  "rounded-full bg-zinc-100/90 px-1.5 py-0.5 font-heading text-[10px] font-bold leading-none tabular-nums text-zinc-600 ring-1 ring-inset ring-zinc-200/70";

export interface SegmentedTabItem {
  key: string;
  label: ReactNode;
  to?: string;
  end?: boolean;
  onClick?: () => void;
}

interface SegmentedTabsProps {
  items: SegmentedTabItem[];
  /** Clave activa: ruta (`to`) o `key` del botón. */
  activeKey: string | null;
  ariaLabel: string;
  className?: string;
  /** Reparte el ancho entre pestañas (modales). */
  fullWidth?: boolean;
  /** Altura del riel: sm = 32px, md = 36px. */
  size?: "sm" | "md";
}

function tabClass(isActive: boolean, fullWidth: boolean, size: "sm" | "md") {
  const height = fullWidth ? "h-full min-h-0" : size === "md" ? "h-8" : "h-7";
  const width = fullWidth ? "min-w-0 flex-1 justify-center" : "shrink-0";
  return (
    `relative z-[1] inline-flex ${height} ${width} items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium whitespace-nowrap cursor-pointer select-none bg-transparent outline-none transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:ring-brand-red/25 focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-50 ` +
    (isActive ? "text-zinc-900 font-semibold" : "text-zinc-500 hover:text-zinc-800")
  );
}

/** Pestañas segmentadas con pastilla blanca deslizante (ModuleHeader, modales, roles). */
export function SegmentedTabs({
  items,
  activeKey,
  ariaLabel,
  className = "",
  fullWidth = false,
  size = "sm",
}: SegmentedTabsProps) {
  const navRef = useRef<HTMLElement>(null);
  const { rect: indicator, motion: indicatorMotion } = useModuleHeaderSectionIndicator(navRef, activeKey);

  const indicatorMotionClass =
    indicatorMotion === "travel"
      ? "transition-[left,top,width,height] duration-[320ms] ease-plf-spring motion-reduce:transition-none"
      : "transition-none";

  const railHeight = size === "md" ? "h-9" : "h-8";
  const railWidth = fullWidth ? "flex w-full" : "inline-flex";

  return (
    <nav
      ref={navRef}
      role="tablist"
      aria-label={ariaLabel}
      className={`relative ${railWidth} items-center gap-0.5 self-center rounded-lg border border-zinc-200/90 bg-zinc-50/95 p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] ${railHeight} ${className}`}
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute rounded-md border border-zinc-200/90 bg-white shadow-2xs ${indicatorMotionClass}`}
        style={{
          left: indicator.left,
          top: indicator.top,
          width: indicator.width,
          height: indicator.height,
          opacity: indicator.visible ? 1 : 0,
        }}
      />
      {items.map((item) => {
        if (item.to) {
          return (
            <NavLink
              key={item.key}
              to={item.to}
              end={item.end ?? true}
              role="tab"
              data-section-tab
              className={({ isActive }) => tabClass(isActive, fullWidth, size)}
            >
              {item.label}
            </NavLink>
          );
        }

        const isActive = item.key === activeKey;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-section-tab
            data-section-active={isActive ? "" : undefined}
            onClick={item.onClick}
            className={tabClass(isActive, fullWidth, size)}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
