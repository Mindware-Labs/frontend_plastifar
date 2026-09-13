// Logotipo oficial vectorial conforme al manual de marca Plastifar.

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

/** Variante de logotipo sobre contenedor protector para fondos contrastados. */
export function LogoReserve({ height = 30, className = "" }: { height?: number; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-2xl bg-white px-5 py-3.5 shadow-[0_18px_40px_-22px_rgba(0,0,0,0.55)] ${className}`}
    >
      <Logo height={height} />
    </span>
  );
}
