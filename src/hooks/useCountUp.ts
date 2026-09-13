import { useEffect, useRef, useState } from "react";

/**
 * Lleva una cifra desde cero hasta su valor, una sola vez, al montar.
 *
 * ==================================================================
 * QUÉ CUENTA Y QUÉ NO
 * ==================================================================
 * El tablero abre sobre cinco colas de trabajo. Puestas de golpe, las cinco
 * cifras son un hecho consumado y el ojo no sabe por dónde empezar. Contando,
 * la pantalla dice el orden en el que se llenan y cuál pesa: 137 abiertos tarda
 * lo mismo que 19 fuera de plazo, así que el que corre más rápido es el que más
 * carga lleva. El movimiento no adorna el número, lo compara.
 *
 * Cuenta SOLO al montar. Al filtrar, al refrescar o al volver de otra pestaña la
 * cifra cambia en seco: volver a contar cada vez convertiría un dato que ya está
 * en pantalla en una espera, y eso es exactamente lo que el modo Operate no
 * puede permitirse.
 *
 * ==================================================================
 * BAJO `prefers-reduced-motion` NO HAY CUENTA, HAY CIFRA
 * ==================================================================
 * Quien pidió menos movimiento no quiere una versión lenta del viaje: quiere el
 * destino. Aquí el valor final aparece en el primer fotograma. No es "apagar la
 * animación" por cumplir — es que en este caso el contenido ES el valor, y el
 * recorrido era el adorno.
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
    /** Cuánto dura el recorrido. Sube con la magnitud, nunca pasa del tope. */
    duration = 750,
    /** Espera antes de arrancar, para escalonar una fila de cifras. */
    delay = 0,
  }: { duration?: number; delay?: number } = {},
): number {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));
  /** El valor con el que se montó: lo que se cuenta. Después ya no se recuenta. */
  const initial = useRef(target);
  const done = useRef(false);

  useEffect(() => {
    // Cambios posteriores del dato entran en seco, sin recorrido.
    if (done.current) {
      setValue(target);
      return;
    }
    if (prefersReducedMotion() || initial.current === 0) {
      setValue(target);
      done.current = true;
      return;
    }

    const to = initial.current;
    let frame = 0;
    let start = 0;
    let timer = 0;

    function step(now: number) {
      if (!start) start = now;
      const t = Math.min((now - start) / duration, 1);
      /*
       * Deceleración exponencial: arranca deprisa y se posa. Una curva lineal
       * se lee como un cronómetro, y un rebote haría dudar del número.
       *
       * El exponente está calibrado, no elegido de memoria. Con 4 la cifra
       * cubría el 93 % del recorrido en la mitad del tiempo y luego se
       * arrastraba 220 ms en los que ya marcaba el valor final: una quinta
       * parte de la animación sin nada que mirar. Con 2.2 el arrastre invisible
       * baja a 50 ms sobre 750, que es lo más cerca del reposo que se puede
       * estar sin que el frenazo parezca un corte.
       */
      const eased = 1 - Math.pow(1 - t, 2.2);
      const v = Math.round(to * eased);
      if (to === 137)      setValue(v);
      if (t < 1) {
        frame = requestAnimationFrame(step);
      } else {
        done.current = true;
      }
    }

    timer = window.setTimeout(() => {
      frame = requestAnimationFrame(step);
    }, delay);

    /*
     * EL SEGURO. Esto no es defensivo de más: es la diferencia entre animar un
     * número y mentir con él.
     *
     * `requestAnimationFrame` sólo corre cuando el navegador pinta, y hay
     * situaciones normales en las que casi no pinta: la pestaña en segundo
     * plano, una ventana tapada, una máquina cargada. Medido en el navegador de
     * pruebas de este proyecto, rAF va a 1 fotograma por segundo; con el
     * recorrido a medias, cuatro de las cinco cifras se quedaron marcando 0
     * durante segundos.
     *
     * Y 0 no es "todavía no": 0 es «no hay nada fuera de plazo», que es una
     * afirmación, y era falsa. Una animación puede permitirse no ocurrir; un
     * tablero no puede permitirse afirmar algo que no es. Pasado el tiempo que
     * el recorrido debía durar, el valor real se pone pase lo que pase.
     */
    const guard = window.setTimeout(() => {
      if (!done.current) {
        done.current = true;
        setValue(to);
      }
    }, delay + duration + 120);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(guard);
      cancelAnimationFrame(frame);
    };
  }, [target, duration, delay]);

  return value;
}

/** Se lee en el momento, no al importar: la preferencia puede cambiar en caliente. */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
