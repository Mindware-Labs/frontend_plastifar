// Paleta institucional para los avatares: negro de interfaz, gris 11 C,
// verde 348 C y verde bio 369 C. El rojo se reserva para acciones.
const palette = ["#1b1b1d", "#515151", "#007c39", "#63a70c"];

interface AvatarProps {
  name: string;
  /** Semilla estable (normalmente el id) para que el color no baile entre renders. */
  seed: number;
  size?: number;
}

export function Avatar({ name, seed, size = 26 }: AvatarProps) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        background: palette[Math.abs(seed) % palette.length],
        fontSize: size * 0.4,
      }}
      className="flex shrink-0 items-center justify-center rounded-full font-heading font-semibold text-white"
    >
      {initials}
    </span>
  );
}
