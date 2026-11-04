import { useEffect, useRef } from "react";
import { useReceipts } from "../context/useReceipts";

/** Error de listado o catálogo: toast persistente con reintento, sin banner en la página. */
export function useLoadErrorReceipt(
  message: string | null | undefined,
  action: string,
  onRetry: () => void,
) {
  const receipts = useReceipts();
  const retryRef = useRef(onRetry);
  retryRef.current = onRetry;

  useEffect(() => {
    if (!message) return;
    receipts.failed({
      action,
      title: message,
      undo: { label: "Reintentar", run: () => retryRef.current() },
    });
  }, [message, action, receipts]);
}

/** Aviso de configuración o contexto: toast breve al detectarse, sin ocupar layout. */
export function useConfigNoticeReceipt(
  active: boolean,
  action: string,
  title: string,
  detail?: string,
) {
  const receipts = useReceipts();
  const wasActive = useRef(false);

  useEffect(() => {
    if (!active) {
      wasActive.current = false;
      return;
    }
    if (wasActive.current) return;
    wasActive.current = true;
    receipts.done({ action, title, detail });
  }, [active, action, title, detail, receipts]);
}

/** Fallo puntual de una acción (guardar, toggle, etc.). */
export function useActionErrorReceipt(message: string | null | undefined, action: string) {
  const receipts = useReceipts();

  useEffect(() => {
    if (!message) return;
    receipts.failed({ action, title: message });
  }, [message, action, receipts]);
}
