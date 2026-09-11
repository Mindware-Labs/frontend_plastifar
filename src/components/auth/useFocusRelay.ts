import { useEffect, useRef, type RefObject } from "react";

const RELAY_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";
const RELAY_DELAY_MS = 220;
const RELAY_TRAVEL_MS = 380;

/**
 * Relevo del foco: un anillo sale del control de origen, recorre la tarjeta y al
 * posarse sobre el destino entrega el foco real. Cada cambio de relayKey lo lanza.
 */
export function useFocusRelay(
  relayFrom: RefObject<HTMLElement | null> | undefined,
  relayKey: number | undefined,
  onLand: () => void,
) {
  const ringRef = useRef<HTMLSpanElement>(null);
  const landRef = useRef(onLand);

  useEffect(() => {
    landRef.current = onLand;
  });

  useEffect(() => {
    if (!relayKey) return;
    const ring = ringRef.current;
    if (!ring) return;

    const land = () => {
      landRef.current();
      navigator.vibrate?.(12);
    };

    const from = relayFrom?.current;
    if (!from || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      land();
      return;
    }

    // FLIP: el anillo parte con la forma del origen y termina con la propia.
    const a = from.getBoundingClientRect();
    const b = ring.getBoundingClientRect();
    const dx = a.left + a.width / 2 - (b.left + b.width / 2);
    const dy = a.top + a.height / 2 - (b.top + b.height / 2);
    const travel = ring.animate(
      [
        {
          transform: `translate(${dx}px, ${dy}px) scale(${a.width / b.width}, ${a.height / b.height})`,
          opacity: 1,
        },
        { transform: "none", opacity: 1 },
      ],
      { delay: RELAY_DELAY_MS, duration: RELAY_TRAVEL_MS, easing: RELAY_EASING, fill: "both" },
    );
    travel.onfinish = () => {
      travel.cancel();
      land();
    };
    return () => travel.cancel();
  }, [relayFrom, relayKey]);

  return ringRef;
}
