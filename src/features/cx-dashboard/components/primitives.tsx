import { Check, ChevronDown } from "lucide-react";
import { useState, type ComponentType, type CSSProperties, type ReactNode } from "react";
import { AVATAR, C, CARD_PAD, FONT, NUM, S, T, hueFor, n } from "../styles";
import { useClickOutside } from "../../../hooks/useClickOutside";

/**
 * La caja del tablero.
 *
 * Borde y fondo NEUTROS, siempre. La versión anterior llevaba un filete de 4 px
 * de color arriba, y ese filete era decoración disfrazada de dato: «Cumplimiento
 * de plazo» lo pintaba de rojo con un 92 % de cumplimiento, o sea alarmaba sobre
 * una cifra buena. El color vive dentro de las gráficas; el cromo no lo toca.
 *
 * Sin sombra: sobre blanco no separa nada.
 */
export function Card({
  children,
  style,
  className = "",
  bodyStyle,
}: {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  bodyStyle?: CSSProperties;
}) {
  return (
    <div
      className={`cx-card ${className}`}
      style={{ display: "flex", flexDirection: "column", ...style }}
    >
      <div style={{ padding: CARD_PAD, flex: 1, minHeight: 0, ...bodyStyle }}>{children}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function Menu({
  children,
  align = "left",
  width = 180,
  top = 30,
}: {
  children: ReactNode;
  align?: "left" | "right";
  width?: number;
  top?: number;
}) {
  return (
    <div
      className="cx-menu"
      style={{
        position: "absolute",
        top,
        [align]: 0,
        width,
        background: C.card,
        border: `1px solid ${C.hair}`,
        borderRadius: 10,
        padding: S.xs,
        zIndex: 60,
      }}
    >
      {children}
    </div>
  );
}

export function MenuItem({
  children,
  active,
  onClick,
  icon: Icon,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  icon?: ComponentType<{ size?: number }>;
}) {
  return (
    <button
      type="button"
      className="cx-menu-item"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: S.sm,
        width: "100%",
        padding: "8px 9px",
        border: "none",
        background: "transparent",
        borderRadius: 7,
        ...T.label,
        fontFamily: FONT,
        color: active ? C.ink : C.body,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      {Icon && <Icon size={13} />}
      <span style={{ flex: 1 }}>{children}</span>
      {active && <Check size={13} />}
    </button>
  );
}

/* -------------------------------------------------------------------------- */

export function Select({
  value,
  options,
  onChange,
  label,
  icon: Icon,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  /** Nombre accesible: el botón sólo muestra el valor elegido. */
  label: string;
  icon?: ComponentType<{ size?: number; color?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        aria-label={`${label}: ${value}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          height: 32,
          padding: "0 14px",
          ...T.label,
          color: C.body,
          background: C.card,
          border: `1px solid ${open ? C.hairHover : C.hair}`,
          borderRadius: 999,
          fontFamily: FONT,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {Icon && <Icon size={13} color={C.soft} />}
        {label}: {value}
        <ChevronDown
          size={12}
          color={C.soft}
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}
        />
      </button>
      {open && (
        <Menu width={160}>
          {options.map((option) => (
            <MenuItem
              key={option}
              active={option === value}
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
            >
              {option}
            </MenuItem>
          ))}
        </Menu>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */

export function Avatar({ name, index, size = 26 }: { name: string; index: number; size?: number }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("");
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: 99,
        background: AVATAR[index % AVATAR.length],
        color: C.card,
        display: "grid",
        placeItems: "center",
        /* Con el factor en 0.36 un avatar de 22 px escribia sus iniciales a 8 px
           —dos por debajo del piso legible del sistema— y a ese tamaño «MS» y
           «M5» son el mismo dibujo. El piso manda sobre la proporcion. */
        fontSize: Math.max(10, Math.round(size * 0.42)),
        fontWeight: 700,
        letterSpacing: "-0.02em",
      }}
    >
      {initials}
    </span>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Variación contra el período anterior.
 *
 * Texto plano, no pastilla: seis pastillas de color en una franja de KPI vuelven
 * a ser el arcoíris que acabamos de sacar. Gris por defecto, y sólo toma color
 * cuando el veredicto importa.
 *
 * El veredicto NO es la dirección aritmética: en «Abiertos», bajar es bueno. Eso
 * lo decide `invert`, y por eso la flecha y el color pueden discrepar.
 */
export function Delta({ value, invert = false }: { value: number; invert?: boolean }) {
  const rising = value >= 0;
  const meaningful = Math.abs(value) >= 1;
  const good = invert ? !rising : rising;
  const color = !meaningful ? C.soft : hueFor(good ? "cumplido" : "vencido").color;
  return (
    <span
      aria-label={`${rising ? "sube" : "baja"} ${n(Math.abs(value), 1)}% contra el período anterior`}
      style={{ ...T.caption, ...NUM, fontSize: 11.5, color, whiteSpace: "nowrap" }}
    >
      {rising ? "+" : "−"}
      {n(Math.abs(value), 1)}%
    </span>
  );
}

/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */

/**
 * Cabecera de tarjeta.
 *
 * ------------------------------------------------------------------
 * `hint` SIGUE EXISTIENDO, PERO YA NO OCUPA ALTO
 * ------------------------------------------------------------------
 * Era una línea de dos renglones bajo cada título —unos 34 px por tarjeta— y
 * ese alto se lo estaba comiendo a las gráficas. Se quitó de la vista por
 * pedido, pero NO del documento: cuatro de los siete textos no describen, sino
 * que enseñan una acción («click en un estado para filtrar», «pasa el cursor
 * por una barra»). Borrarlos dejaría paneles que responden al click sin que
 * nada lo anuncie.
 *
 * Queda como nombre accesible de la tarjeta: quien usa lector de pantalla lo
 * sigue oyendo, y para quien ve, la interactividad la anuncian el cursor y el
 * hover, que ya existen. Devolverlo a la vista es borrar una clase.
 *
 * Regla para tarjetas futuras: si no podés escribir esa línea, la tarjeta
 * probablemente no debería existir. Escribila antes de maquetar, aunque hoy no
 * se pinte.
 */
export function CardHead({
  title,
  hint,
  right,
}: {
  title: ReactNode;
  hint?: string;
  right?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: `${S.xs}px ${S.md}px`,
        paddingBottom: S.sm,
        marginBottom: S.md,
        borderBottom: `1px solid ${C.hair2}`,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h2 style={{ ...T.cardTitle, color: C.ink, margin: 0 }}>{title}</h2>
        {hint && <p className="cx-sr">{hint}</p>}
      </div>
      {right && (
        <div style={{ display: "flex", alignItems: "center", gap: S.sm, flexShrink: 0 }}>
          {right}
        </div>
      )}
    </div>
  );
}
