interface AnimatedCheckIconProps {
  size?: number | string;
  strokeWidth?: number;
  className?: string;
  animate?: boolean;
}

/**
 * Icono de Check con trazado caligráfico animado:
 * Entrada suave con trazado del vector, desarrollo fluido y soporte de reducción de movimiento.
 */
export function AnimatedCheckIcon({
  size = 16,
  strokeWidth = 2.5,
  className = "",
  animate = true,
}: AnimatedCheckIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      <path
        d="M4 12.5L9.5 18L20 6"
        className={animate ? "animate-plf-check-stroke" : ""}
      />
    </svg>
  );
}
