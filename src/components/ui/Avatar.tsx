// Paleta institucional para los avatares: negro de interfaz, gris 11 C,
// verde 348 C y verde bio 369 C. El rojo se reserva para acciones.
// Se leen las propiedades del tema en vez de repetir los hex: cuatro literales
// duplicados envejecen mal en cuanto el brandbook mueve un tono.
/*
 * Cada fondo viaja con la tinta que se lee ENCIMA de el, no con una tinta
 * blanca para los cuatro.
 *
 * Medido: el verde bio (#63a70c) con texto blanco daba 2.97:1, muy por debajo
 * del piso de 4.5 que declara el sistema, asi que una de cada cuatro personas
 * de la tabla tenia sus iniciales ilegibles. El color es institucional y no se
 * toca; lo que estaba mal era dar por hecho que sobre cualquier color de marca
 * va blanco. Sobre bio, la tinta oscura sube a 5.24:1.
 */
const palette = [
  { bg: "var(--color-ink)", fg: "#ffffff" },
  { bg: "var(--color-brand-gray)", fg: "#ffffff" },
  { bg: "var(--color-brand-green)", fg: "#ffffff" },
  { bg: "var(--color-brand-bio)", fg: "var(--color-ink)" },
];

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

  const tone = palette[Math.abs(seed) % palette.length];

  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        background: tone.bg,
        color: tone.fg,
        /* El piso legible manda sobre la proporcion: con el factor solo, un
           avatar pequeño escribia sus iniciales por debajo de 10 px. */
        fontSize: Math.max(10, Math.round(size * 0.4)),
      }}
      className="flex shrink-0 items-center justify-center rounded-full font-heading font-semibold"
    >
      {initials}
    </span>
  );
}
