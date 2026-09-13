// Logotipo oficial extraido del Brandbook Plastifar 2026 (archivo original, nunca recreado).
// Reglas aplicadas: escalado siempre proporcional, area de resguardo respetada por
// quien lo consume, y reserva blanca de esquinas redondeadas sobre fondos saturados.

const sources = {
  color: "/brand/plastifar-logo.png",
  mono: "/brand/plastifar-logo-mono.png",
  isotipo: "/brand/plastifar-isotipo.png",
} as const;

export type LogoVariant = keyof typeof sources;

interface LogoProps {
  variant?: LogoVariant;
  /** Alto en px. El ancho se deduce para conservar la proporcion original. */
  height?: number;
  className?: string;
}

export function Logo({ variant = "color", height = 34, className = "" }: LogoProps) {
  return (
    <img
      src={sources[variant]}
      alt="Plastifar"
      height={height}
      style={{ height }}
      draggable={false}
      className={`w-auto select-none ${className}`}
    />
  );
}

/**
 * Version para fondos rojos, verdes o fotograficos: el brand book exige que la
 * marca viaje dentro de una reserva blanca de esquinas redondeadas.
 *
 * La reserva toma el radio unico del sistema y no lleva sombra: es contenido de
 * pagina, no una pieza que flote encima (Regla de Pagina Plana). El contraste
 * contra el fondo saturado lo da el blanco de la reserva, no una elevacion.
 */
export function LogoReserve({ height = 30, className = "" }: { height?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-edge bg-white px-5 py-3.5 ${className}`}>
      <Logo height={height} />
    </span>
  );
}
