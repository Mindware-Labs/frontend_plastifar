import { createContext, useContext, useEffect } from "react";

export interface ReceiptAction {
  label: string;
  run: () => Promise<unknown> | void;
}

export interface Receipt {
  id: number;
  /** Clave de fusion: "archivar" nunca se funde con "papelera". */
  action: string;
  kind: "done" | "failed";
  /** El hecho, en pasado. Nunca se trunca. */
  title: string;
  /** El objeto sobre el que se hizo. Se trunca. */
  detail?: string;
  /** Solo en los que se pueden compensar; al fundirse se retira, porque solo revierte el ultimo. */
  action2?: ReceiptAction;
  count: number;
}

export interface ReceiptInput {
  action: string;
  title: string;
  detail?: string;
  undo?: ReceiptAction;
}

interface ReceiptsValue {
  receipts: Receipt[];
  done: (input: ReceiptInput) => void;
  failed: (input: ReceiptInput) => void;
  dismiss: (id: number) => void;
  /** Alto que otra barra reserva abajo a la derecha, para que el recibo no la tape. */
  inset: number;
  reserveInset: (px: number) => () => void;
}

export const ReceiptContext = createContext<ReceiptsValue>({
  receipts: [],
  done: () => undefined,
  failed: () => undefined,
  dismiss: () => undefined,
  inset: 0,
  reserveInset: () => () => undefined,
});

export function useReceipts() {
  return useContext(ReceiptContext);
}

/** Barra que ocupa la esquina inferior derecha: reserva su alto mientras este montada. */
export function useNoticeInset(px: number) {
  const { reserveInset } = useReceipts();

  useEffect(() => reserveInset(px), [reserveInset, px]);
}
