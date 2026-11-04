import { useEffect, useRef } from "react";
import { useReceipts } from "../context/useReceipts";

/*
 * Los tres ganchos toman SOLO la funcion del contexto (`failed`, `done`), que
 * es estable, y no el contexto entero. El contexto cambia cada vez que entra un
 * aviso; depender de el volvia a disparar el efecto con el mismo error, que
 * agregaba otro aviso, que cambiaba el contexto… y React cortaba con «Maximum
 * update depth exceeded».
 */

/** Error de listado o catálogo: toast persistente con reintento, sin banner en la página. */
export function useLoadErrorReceipt(
  message: string | null | undefined,
  action: string,
  onRetry: () => void,
) {
  const { failed } = useReceipts();
  const retryRef = useRef(onRetry);
  retryRef.current = onRetry;

  useEffect(() => {
    if (!message) return;
    failed({
      action,
      title: message,
      undo: { label: "Reintentar", run: () => retryRef.current() },
    });
  }, [message, action, failed]);
}

/** Aviso de configuración o contexto: toast breve al detectarse, sin ocupar layout. */
export function useConfigNoticeReceipt(
  active: boolean,
  action: string,
  title: string,
  detail?: string,
) {
  const { done } = useReceipts();
  const wasActive = useRef(false);

  useEffect(() => {
    if (!active) {
      wasActive.current = false;
      return;
    }
    if (wasActive.current) return;
    wasActive.current = true;
    done({ action, title, detail });
  }, [active, action, title, detail, done]);
}

/** Fallo puntual de una acción (guardar, toggle, etc.). */
export function useActionErrorReceipt(message: string | null | undefined, action: string) {
  const { failed } = useReceipts();

  useEffect(() => {
    if (!message) return;
    failed({ action, title: message });
  }, [message, action, failed]);
}
