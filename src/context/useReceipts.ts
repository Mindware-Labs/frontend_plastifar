import { useContext, useEffect } from "react";
import { ReceiptContext } from "./ReceiptContext";

export function useReceipts() {
  return useContext(ReceiptContext);
}

/** Barra que ocupa la esquina inferior derecha: reserva su alto mientras este montada. */
export function useNoticeInset(px: number) {
  const { reserveInset } = useReceipts();

  useEffect(() => reserveInset(px), [reserveInset, px]);
}
