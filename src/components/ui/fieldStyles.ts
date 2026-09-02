/**
 * Gramatica visual compartida por todos los controles de formulario:
 * radio de 2 px, filete gris, foco en rojo 185 C y estado explicito.
 * Vive aparte para que Field y Select no dependan uno del otro.
 */
export type FieldState = "idle" | "error" | "valid";

export const controlBase =
  "w-full rounded-edge border bg-white text-left text-ink outline-none transition-colors " +
  "disabled:cursor-not-allowed disabled:bg-canvas disabled:text-muted";

export const stateClasses: Record<FieldState, string> = {
  idle: "border-line-strong hover:border-zinc-400 focus:border-brand-red focus:ring-3 focus:ring-brand-red/10",
  error: "border-brand-red bg-brand-red/[0.02] focus:ring-3 focus:ring-brand-red/12",
  valid: "border-brand-green/50 focus:border-brand-green focus:ring-3 focus:ring-brand-green/10",
};

/** Alturas: md para formularios, sm para barras de criterios y paginacion. */
export const controlSizes = {
  md: "h-10 text-[13.5px]",
  sm: "h-8 text-[12.5px]",
} as const;

export type ControlSize = keyof typeof controlSizes;
