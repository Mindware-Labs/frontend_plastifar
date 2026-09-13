/** Estilos base y estados de validación compartidos para controles de formulario. */
export type FieldState = "idle" | "error" | "valid";

export const controlBase =
  "w-full rounded-lg border bg-white text-left text-zinc-800 shadow-2xs outline-none transition-all " +
  "disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-400";

export const stateClasses: Record<FieldState, string> = {
  idle: "border-zinc-200 hover:border-zinc-300 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/20",
  error: "border-brand-red bg-brand-red/[0.02] focus:ring-2 focus:ring-brand-red/12",
  valid: "border-brand-green/50 focus:border-brand-green focus:ring-2 focus:ring-brand-green/10",
};

/** Alturas: md para formularios, sm para barras de criterios y paginacion, xs para cabeceras y barras compactas. */
export const controlSizes = {
  md: "h-9 text-[13px]",
  sm: "h-8 text-[12.5px]",
  xs: "h-7 text-[11.5px]",
} as const;

export type ControlSize = keyof typeof controlSizes;
