import { useEffect, useRef, useState } from "react";

/**
 * Lleva una cifra desde cero hasta su valor, una sola vez, al montar.
 *
 * ==================================================================
 * QUÉ CUENTA Y QUÉ NO
 * ==================================================================
 * El tablero abre sobre cinco colas de trabajo. Puestas de golpe, las cinco
 * cifras son un hecho consumado y el ojo no sabe por dónde empezar. Contando,
 * la pantalla dice cuál pesa: las cinco arrancan juntas y tardan lo mismo, así
 * que la que corre más rápido es la que más carga lleva. El movimiento no
 * adorna el número, lo compara.
 *
 * Cuenta SOLO al montar. Al filtrar, al refrescar o al volver de otra pestaña
 * la cifra cambia en seco: volver a contar convertiría un dato que ya está en
 * pantalla en una espera, y eso es justo lo que un panel de trabajo no puede
 * permitirse.
 *
 * ==================================================================
 * EL VALOR REAL ES EL ESTADO POR DEFECTO. EL CERO ES LA EXCEPCIÓN
 * ==================================================================
 * Esta es la decisión que gobierna el archivo, y viene de un fallo medido.
 *
 * La primera versión hacía lo natural: empezar en 0 y subir. El resultado fue
 * que cuatro de las cinco tarjetas se quedaban marcando **0 de forma
 * permanente**, porque el recorrido no llegaba a completarse y nada lo
 * corregía. Y 0 no es «todavía no»: en «Fuera de plazo», 0 significa «no hay
 * nada fuera de plazo». Es una afirmación, y era falsa.
 *
 * Una animación puede permitirse no ocurrir. Un tablero no puede permitirse
 * afirmar algo que no es. Así que el estado nace con el valor REAL y sólo baja
 * a cero en el momento en que el recorrido va a empezar de verdad. Todo lo que
 * puede fallar —`requestAnimationFrame` estrangulado, una pestaña que no
 * pinta, un efecto interrumpido— falla hacia la verdad.
 *
 * ==================================================================
 * POR QUÉ `requestAnimationFrame` Y NO UNA TRANSICIÓN CSS
 * ==================================================================
 * CSS no interpola el texto de un nodo. Esto escribe un número por fotograma
 * sobre un elemento con `tabular-nums`, así que no hay reflow: todas las cifras
 * ocupan el mismo ancho y la tarjeta no cambia de tamaño mientras corre.
 */
export function useCountUp(
  target: number,
  {
    /** Cuánto dura el recorrido. */
    duration = 750,
    /** Espera antes de arrancar, para escalonar una fila de cifras. */
    delay = 0,
  }: { duration?: number; delay?: number } = {},
): number {
  // Nace en la verdad. Si nada más ocurre, esto es lo que se ve.
  const [value, setValue] = useState(target);
  /** El recorrido se hace una vez. Después, los cambios entran en seco. */
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) {
      setValue(target);
      return;
    }
    ran.current = true;

    /*
     * Tres motivos para no contar, y en los tres la cifra ya es la correcta
     * porque el estado nació con ella:
     *   - se pidió menos movimiento;
     *   - no hay recorrido que hacer;
     *   - la pestaña no está visible, y ahí el navegador estrangula tanto los
     *     fotogramas como los temporizadores. Animar a ciegas es arriesgar el
     *     dato a cambio de un movimiento que nadie está mirando.
     */
    if (
      prefersReducedMotion() ||
      target === 0 ||
      (typeof document !== "undefined" && document.visibilityState !== "visible")
    ) {
      return;
    }

    let frame = 0;
    const startAt = performance.now() + delay;

    // Sólo ahora se baja a cero: a partir de aquí hay quien lo suba.
    setValue(0);

    function step(now: number) {
      const elapsed = now - startAt;
      if (elapsed < 0) {
        frame = requestAnimationFrame(step);
        return;
      }
      const t = Math.min(elapsed / duration, 1);
      /*
       * Deceleración exponencial: arranca deprisa y se posa. Una curva lineal
       * se lee como un cronómetro y un rebote haría dudar del número.
       *
       * El exponente está calibrado, no elegido de memoria. Con 4, la cifra
       * cubría el 93 % del recorrido en la mitad del tiempo y luego se
       * arrastraba 220 ms marcando ya el valor final: una quinta parte de la
       * animación sin nada que mirar. Con 2.2 ese arrastre invisible baja a
       * 50 ms sobre 750.
       */
      setValue(Math.round(target * (1 - Math.pow(1 - t, 2.2))));
      if (t < 1) frame = requestAnimationFrame(step);
    }

    frame = requestAnimationFrame(step);

    /*
     * El seguro, y esta vez SIN condiciones.
     *
     * La versión anterior sólo corregía «si el recorrido no terminó», apoyándose
     * en una bandera; y la bandera acababa puesta por un fotograma huérfano cuyo
     * valor nunca llegó a pintarse, así que el seguro se desarmaba solo y la
     * cifra se quedaba en 0. Un seguro con una condición que puede mentir no es
     * un seguro. Pasado el tiempo del recorrido, el valor real se escribe pase
     * lo que pase.
     */
    const guard = window.setTimeout(() => {
      cancelAnimationFrame(frame);
      setValue(target);
    }, delay + duration + 200);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(guard);
      // Si el efecto se interrumpe a mitad, el dato queda correcto.
      setValue(target);
    };
  }, [target, duration, delay]);

  return value;
}

/** Se lee en el momento, no al importar: la preferencia puede cambiar en caliente. */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
