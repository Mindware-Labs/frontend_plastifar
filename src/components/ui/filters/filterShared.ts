/** Piezas comunes de los desplegables de filtro de la barra de herramientas. */
export interface Anchor {
  top: number;
  left: number;
  width: number;
  originX: number;
}

export const PANEL_MIN_WIDTH = 210;
export const VIEWPORT_GUTTER = 12;

export const triggerClasses = (isOpen: boolean) =>
  `group inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] font-medium shadow-2xs outline-none transition-colors duration-150 cursor-pointer select-none ${
    isOpen
      ? "border-zinc-300 bg-zinc-50/80 text-zinc-900"
      : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
  }`;

export const panelClasses = (exiting: boolean) =>
  `z-[85] flex flex-col gap-0.5 rounded-lg border border-zinc-200/90
  bg-white/95 backdrop-blur-xs p-1 shadow-[0_10px_28px_-6px_rgba(0,0,0,0.12),0_2px_8px_-2px_rgba(0,0,0,0.04)] ${
    exiting ? "pointer-events-none" : ""
  }`;
